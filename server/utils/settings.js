const Setting = require('../models/Setting');

// In-memory cache so pricing (a hot path) never blocks on a DB read.
// Invalidated on every admin update; also refreshed after the TTL.
let cache = null;
let cachedAt = 0;
const TTL_MS = 15 * 1000;

const envNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const envDefaults = () => ({
  taxRate: envNumber('TAX_RATE_PERCENT', 0),
  deliveryFee: envNumber('DELIVERY_FEE', 0),
  freeDeliveryAbove: envNumber('FREE_DELIVERY_ABOVE', 0),
  minOrderAmount: 0,
  stockThreshold: envNumber('STOCK_THRESHOLD', 20),
  storeOpen: true,
  deliveryEnabled: true,
  storeName: 'Pizza Man',
  supportPhone: '',
  supportEmail: '',
});

const merge = (doc) => {
  const defaults = envDefaults();
  if (!doc) return defaults;
  const out = { ...defaults };
  for (const [key, value] of Object.entries(defaults)) {
    if (doc[key] !== undefined && doc[key] !== null) out[key] = doc[key];
  }
  return out;
};

const getSettings = async ({ fresh = false } = {}) => {
  if (!fresh && cache && Date.now() - cachedAt < TTL_MS) return cache;
  try {
    const doc = await Setting.findOne({ key: 'store' }).lean();
    cache = merge(doc);
  } catch (error) {
    console.error('Settings read failed, using env defaults:', error.message);
    cache = merge(null);
  }
  cachedAt = Date.now();
  return cache;
};

const invalidateSettings = () => {
  cache = null;
  cachedAt = 0;
};

module.exports = { getSettings, invalidateSettings, envDefaults };
