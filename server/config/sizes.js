// Single source of truth for pizza sizes.
// Multipliers scale the ingredient subtotal (medium = 1.0).
// Override at runtime with SIZE_MULTIPLIERS="small:0.9,medium:1,large:1.35"
const DEFAULT_SIZES = [
  { key: 'small', name: 'Small', label: '7"', multiplier: 0.85 },
  { key: 'medium', name: 'Medium', label: '10"', multiplier: 1 },
  { key: 'large', name: 'Large', label: '13"', multiplier: 1.3 },
];

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const getSizes = () => {
  const raw = (process.env.SIZE_MULTIPLIERS || '').trim();
  if (!raw) return DEFAULT_SIZES;

  const overrides = new Map();
  for (const pair of raw.split(',')) {
    const [key, value] = pair.split(':');
    if (key && value) overrides.set(key.trim().toLowerCase(), toNumber(value, null));
  }
  if (overrides.size === 0) return DEFAULT_SIZES;

  return DEFAULT_SIZES.map((size) => {
    const override = overrides.get(size.key);
    return override ? { ...size, multiplier: override } : size;
  });
};

const findSize = (key) => {
  const sizes = getSizes();
  const normalized = String(key || 'medium').trim().toLowerCase();
  return sizes.find((size) => size.key === normalized) || null;
};

module.exports = { getSizes, findSize, DEFAULT_SIZES };
