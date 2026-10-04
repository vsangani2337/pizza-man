/** Shared cart-line builders so every page adds items in exactly the same shape. */

export const round2 = (value) => Math.round(value * 100) / 100;

export const formatINR = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Menu sizes are optional — fall back to a sensible medium. */
export const pickSize = (sizes, key = 'medium') =>
  sizes?.find((size) => size.key === key) || sizes?.[1] || { key: 'medium', name: 'Medium', multiplier: 1 };

/** A signature pizza → cart line (server reprices at checkout). */
export const productToCart = (product, size) => ({
  type: 'pizza',
  productId: product._id,
  name: product.name,
  image: product.image || '',
  size: size.key,
  sizeName: size.name,
  quantity: 1,
  unitPrice: round2((Number(product.price) || 0) * (size.multiplier || 1)),
  customization: {
    base: product.pizza?.base,
    sauce: product.pizza?.sauce,
    cheese: product.pizza?.cheese,
    veggies: product.pizza?.veggies || [],
    addons: [],
    size: size.key,
    sizeName: size.name,
  },
});

/** A drink → cart line. */
export const drinkToCart = (drink) => ({
  type: 'drink',
  productId: null,
  name: drink.name,
  image: drink.image || '',
  size: null,
  sizeName: null,
  quantity: 1,
  unitPrice: Number(drink.price) || 0,
  customization: null,
});

/** Human-readable customization summary for cart / checkout / receipts. */
export const customizationSummary = (item) => {
  if (item?.type === 'drink') return 'Cold drink';
  const c = item?.customization || {};
  const parts = [c.base, c.sauce, c.cheese].filter(Boolean);
  if (c.veggies?.length) parts.push(c.veggies.join(', '));
  if (c.addons?.length) parts.push(`+ ${c.addons.join(', ')}`);
  return parts.join(' · ');
};
