const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { getSettings, invalidateSettings } = require('../utils/settings');

const sanitize = (body = {}) => {
  const out = {};
  const num = (value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < min || n > max) return null;
    return n;
  };

  const numericRules = {
    taxRate: [0, 100],
    deliveryFee: [0, 10000],
    freeDeliveryAbove: [0, 100000],
    minOrderAmount: [0, 100000],
    stockThreshold: [0, 100000],
  };
  for (const [key, [min, max]] of Object.entries(numericRules)) {
    if (body[key] !== undefined) {
      const value = num(body[key], min, max);
      if (value === null) return { error: `Invalid value for ${key}.` };
      out[key] = value;
    }
  }
  for (const key of ['storeOpen', 'deliveryEnabled']) {
    if (body[key] !== undefined) out[key] = Boolean(body[key]);
  }
  if (body.storeName !== undefined) {
    const name = String(body.storeName).trim();
    if (name.length < 2 || name.length > 60) return { error: 'Store name must be 2–60 characters.' };
    out.storeName = name;
  }
  if (body.supportPhone !== undefined) out.supportPhone = String(body.supportPhone).trim().slice(0, 20);
  if (body.supportEmail !== undefined) out.supportEmail = String(body.supportEmail).trim().slice(0, 100);
  return { payload: out };
};

// @route   GET /api/settings
// @desc    Public store settings (used by checkout for open/closed + charges)
router.get('/', async (req, res) => {
  try {
    const settings = await getSettings({ fresh: true });
    res.json(settings);
  } catch (error) {
    console.error('Settings read error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   PUT /api/settings
// @desc    Update store settings (admin)
router.put('/', auth, adminMiddleware, async (req, res) => {
  try {
    const { payload, error } = sanitize(req.body);
    if (error) return res.status(400).json({ message: error });
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'No valid settings provided.' });
    }

    const doc = await Setting.findOneAndUpdate(
      { key: 'store' },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    invalidateSettings();
    res.json(await getSettings({ fresh: true }));
  } catch (error) {
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map((e) => e.message).join(' ');
      return res.status(400).json({ message });
    }
    console.error('Settings update error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
