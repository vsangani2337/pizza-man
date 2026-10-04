const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const { findSize, getSizes } = require('../config/sizes');
const { getSettings } = require('./settings');

class PricingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const badRequest = (message) => new PricingError(400, message);

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const round2 = (value) => Math.round(value * 100) / 100;

// Charges come from Store Settings (DB) with environment fallbacks.
// Defaults are 0 so existing behaviour (total === sum of items) is preserved.
const calculateCharges = (subtotal, settings) => {
  const config = {
    deliveryFee: Math.max(0, Number(settings?.deliveryFee) || 0),
    freeDeliveryAbove: Math.max(0, Number(settings?.freeDeliveryAbove) || 0),
    taxRatePercent: Math.max(0, Number(settings?.taxRate) || 0),
  };
  let deliveryFee = config.deliveryFee;
  if (deliveryFee > 0 && config.freeDeliveryAbove > 0 && subtotal >= config.freeDeliveryAbove) {
    deliveryFee = 0;
  }
  const tax = round2((subtotal * config.taxRatePercent) / 100);
  return {
    deliveryFee: round2(deliveryFee),
    tax,
    taxRatePercent: config.taxRatePercent,
    freeDeliveryAbove: config.freeDeliveryAbove,
  };
};

const normalizeQuantity = (raw) => {
  const quantity = raw === undefined || raw === null || raw === '' ? 1 : Number(raw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    throw badRequest('Quantity must be a whole number between 1 and 50.');
  }
  return quantity;
};

const requireName = (value, label) => {
  const name = String(value ?? '').trim();
  if (!name) throw badRequest(`${label} is required.`);
  if (name.length > 80) throw badRequest(`${label} is too long.`);
  return name;
};

const parseNameList = (raw, label, max = 20) => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw badRequest(`${label} must be a list.`);
  if (raw.length > max) throw badRequest(`A maximum of ${max} ${label.toLowerCase()} is allowed.`);
  const seen = new Set();
  const names = [];
  for (const entry of raw) {
    const name = requireName(entry, label.replace(/s$/, ''));
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
};

const resolve = (catalog, name, categories, label) => {
  for (const category of categories) {
    const found = catalog.get(`${category}:${name.toLowerCase()}`);
    if (found) {
      if (found.available === false) {
        throw badRequest(`${found.name} is currently unavailable.`);
      }
      return found;
    }
  }
  throw badRequest(`Unknown ${label}: "${name}".`);
};

const loadCatalog = async () => {
  const items = await Inventory.find({
    category: { $in: ['base', 'sauce', 'cheese', 'veggie', 'meat', 'drink', 'addon'] },
  }).lean();

  const catalog = new Map();
  for (const item of items) {
    catalog.set(`${item.category}:${item.name.toLowerCase()}`, item);
  }
  return catalog;
};

const loadProduct = async (productId) => {
  let product = null;
  try {
    product = await Product.findById(productId).lean();
  } catch {
    throw badRequest('Unknown product.');
  }
  if (!product) throw badRequest('Unknown product.');
  if (!product.available) throw badRequest(`${product.name} is currently unavailable.`);
  return product;
};

const resolveSize = (rawSize) => {
  if (rawSize === undefined || rawSize === null || rawSize === '') {
    return findSize('medium');
  }
  const size = findSize(rawSize);
  if (!size) throw badRequest(`Unknown size: "${rawSize}".`);
  return size;
};

/**
 * Turns a raw client payload into a fully priced, database-backed quote.
 * The client only ever supplies identifiers + quantities — never prices.
 * Supports: custom pizzas, preset products (productId), drinks, sizes, add-ons.
 */
const quoteItems = async (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw badRequest('At least one item is required.');
  }
  if (rawItems.length > 20) {
    throw badRequest('Too many items in a single request.');
  }

  const catalog = await loadCatalog();
  const quotes = [];

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') throw badRequest('Invalid item payload.');
    const type = raw.type === 'drink' ? 'drink' : raw.type === 'pizza' ? 'pizza' : null;
    if (!type) throw badRequest('Item type must be "pizza" or "drink".');
    const quantity = normalizeQuantity(raw.quantity);

    if (type === 'drink') {
      const name = requireName(raw.name, 'Drink name');
      const drink = resolve(catalog, name, ['drink'], 'drink');
      if (drink.quantity < quantity) {
        throw badRequest(
          drink.quantity <= 0
            ? `${drink.name} is out of stock.`
            : `Only ${drink.quantity} x ${drink.name} left in stock.`
        );
      }
      quotes.push({
        type,
        quantity,
        name: drink.name,
        image: drink.image || '',
        productId: null,
        size: null,
        sizeName: null,
        customization: null,
        lines: [{ label: drink.name, category: 'drink', unitPrice: round2(drink.price) }],
        unitTotal: round2(drink.price),
        subtotal: round2(drink.price * quantity),
      });
      continue;
    }

    // ---- pizza ----
    const size = resolveSize(raw.size);
    const addonNames = parseNameList(raw.addons, 'Add-ons');
    const addonItems = addonNames.map((name) => resolve(catalog, name, ['addon'], 'add-on'));

    const addonLines = addonItems.map((item) => ({
      label: item.name,
      category: 'addon',
      unitPrice: round2(item.price),
    }));

    let customization;
    let mainLines;
    let name;
    let image;
    let productId = null;

    if (raw.productId) {
      const product = await loadProduct(raw.productId);
      productId = String(product._id);
      name = product.name;
      image = product.image || '';
      customization = {
        base: product.pizza.base,
        sauce: product.pizza.sauce,
        cheese: product.pizza.cheese,
        veggies: [...(product.pizza.veggies || [])],
      };
      mainLines = [
        {
          label: `${product.name} (${size.name})`,
          category: 'product',
          unitPrice: round2(product.price * size.multiplier),
        },
      ];
    } else {
      const baseName = requireName(raw.base, 'Base');
      const sauceName = requireName(raw.sauce, 'Sauce');
      const cheeseName = requireName(raw.cheese, 'Cheese');
      const toppingNames = parseNameList(raw.veggies, 'Toppings');

      const base = resolve(catalog, baseName, ['base'], 'base');
      const sauce = resolve(catalog, sauceName, ['sauce'], 'sauce');
      const cheese = resolve(catalog, cheeseName, ['cheese'], 'cheese');
      const toppings = toppingNames.map((name) =>
        resolve(catalog, name, ['veggie', 'meat'], 'topping')
      );

      customization = {
        base: base.name,
        sauce: sauce.name,
        cheese: cheese.name,
        veggies: toppings.map((item) => item.name),
      };
      name = 'Custom Pizza';
      image = '';
      mainLines = [base, sauce, cheese, ...toppings].map((item) => ({
        label: item.name,
        category: item.category,
        unitPrice: round2(item.price * size.multiplier),
      }));
    }

    const lines = [...mainLines, ...addonLines];
    const unitTotal = round2(lines.reduce((sum, line) => sum + line.unitPrice, 0));
    if (unitTotal <= 0) throw badRequest('Order total must be greater than zero.');

    customization.size = size.key;
    customization.sizeName = size.name;
    customization.addons = addonItems.map((item) => item.name);

    quotes.push({
      type,
      quantity,
      name,
      image,
      productId,
      size: size.key,
      sizeName: size.name,
      customization,
      lines,
      unitTotal,
      subtotal: round2(unitTotal * quantity),
    });
  }

  const subtotal = round2(quotes.reduce((sum, item) => sum + item.subtotal, 0));
  const settings = await getSettings();
  const charges = calculateCharges(subtotal, settings);
  const total = round2(subtotal + charges.deliveryFee + charges.tax);

  if (total <= 0) throw badRequest('Order total must be greater than zero.');

  return {
    currency: 'INR',
    quotes,
    sizes: getSizes(),
    summary: {
      subtotal,
      deliveryFee: charges.deliveryFee,
      tax: charges.tax,
      taxRatePercent: charges.taxRatePercent,
      freeDeliveryAbove: charges.freeDeliveryAbove,
      minOrderAmount: settings.minOrderAmount || 0,
      discount: 0,
      total,
    },
    store: {
      storeName: settings.storeName,
      storeOpen: settings.storeOpen,
      deliveryEnabled: settings.deliveryEnabled,
      minOrderAmount: settings.minOrderAmount || 0,
    },
  };
};

/**
 * Aggregates ingredient demand across every quoted line so multi-item carts
 * are stock-checked as a whole (2 × same base must exist twice in stock).
 * Returns [{ categories, name, qty }].
 */
const buildNeeds = (quotes) => {
  const needs = new Map();
  const add = (categories, name, qty) => {
    const key = `${categories.join('|')}:${String(name).toLowerCase()}`;
    const existing = needs.get(key);
    if (existing) existing.qty += qty;
    else needs.set(key, { categories, name: String(name), qty });
  };

  for (const quote of Array.isArray(quotes) ? quotes : [quotes]) {
    const qty = Number.isInteger(quote.quantity) && quote.quantity > 0 ? quote.quantity : 1;
    if (quote.type === 'drink') {
      add(['drink'], quote.name, qty);
      continue;
    }
    const c = quote.customization || {};
    if (c.base) add(['base'], c.base, qty);
    if (c.sauce) add(['sauce'], c.sauce, qty);
    if (c.cheese) add(['cheese'], c.cheese, qty);
    for (const topping of c.veggies || []) add(['veggie', 'meat'], topping, qty);
    for (const addon of c.addons || []) add(['addon'], addon, qty);
  }

  return [...needs.values()];
};

/** Fails fast when any aggregated ingredient demand exceeds available stock. */
const assertStock = async (quotes) => {
  const catalog = await loadCatalog();
  const problems = [];

  for (const need of buildNeeds(quotes)) {
    let item = null;
    for (const category of need.categories) {
      item = catalog.get(`${category}:${need.name.toLowerCase()}`);
      if (item) break;
    }
    if (!item) throw badRequest(`Unknown item: "${need.name}".`);
    if (item.quantity < need.qty) {
      problems.push(
        item.quantity <= 0
          ? `${item.name} is out of stock.`
          : `Only ${item.quantity} x ${item.name} left in stock (you asked for ${need.qty}).`
      );
    }
  }

  if (problems.length > 0) throw badRequest(problems[0]);
};

/**
 * Atomic, guarded stock deduction for one or many quoted lines.
 * Never lets inventory go negative; skips (and reports) anything short.
 */
const decrementStock = async (quotes) => {
  const catalog = await loadCatalog();
  for (const need of buildNeeds(quotes)) {
    let item = null;
    for (const category of need.categories) {
      item = catalog.get(`${category}:${need.name.toLowerCase()}`);
      if (item) break;
    }
    if (!item) {
      console.warn(`Stock decrement skipped for unknown item ${need.name}`);
      continue;
    }
    const updated = await Inventory.findOneAndUpdate(
      { _id: item._id, quantity: { $gte: need.qty } },
      { $inc: { quantity: -need.qty } }
    );
    if (!updated) {
      console.warn(`Stock decrement skipped for ${item.name} (insufficient).`);
    }
  }
};

/** Best-effort stock restore used when a placed order is cancelled. */
const restoreStock = async (quotes) => {
  try {
    const catalog = await loadCatalog();
    for (const need of buildNeeds(quotes)) {
      let item = null;
      for (const category of need.categories) {
        item = catalog.get(`${category}:${need.name.toLowerCase()}`);
        if (item) break;
      }
      if (!item) continue;
      await Inventory.updateOne({ _id: item._id }, { $inc: { quantity: need.qty } });
    }
  } catch (error) {
    console.error('Stock restore failed:', error.message);
    throw error;
  }
};

module.exports = { quoteItems, assertStock, decrementStock, restoreStock, buildNeeds, PricingError };
