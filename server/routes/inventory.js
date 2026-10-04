const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const StockLog = require('../models/StockLog');
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { getSettings } = require('../utils/settings');

const CATEGORIES = ['base', 'sauce', 'cheese', 'veggie', 'meat', 'drink', 'addon'];
const MAX_LIMIT = 100;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePayload = (body = {}) => {
  const payload = {};

  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) {
      return { error: 'Category must be one of: ' + CATEGORIES.join(', ') + '.' };
    }
    payload.category = body.category;
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return { error: 'Name is required.' };
    if (name.length > 80) return { error: 'Name must be 80 characters or fewer.' };
    payload.name = name;
  }

  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return { error: 'Quantity must be a whole number of 0 or more.' };
    }
    payload.quantity = quantity;
  }

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return { error: 'Price must be a number of 0 or more.' };
    }
    payload.price = price;
  }

  if (body.maxStock !== undefined) {
    const maxStock = Number(body.maxStock);
    if (!Number.isInteger(maxStock) || maxStock < 1) {
      return { error: 'Max stock must be a whole number of 1 or more.' };
    }
    payload.maxStock = maxStock;
  }

  if (body.image !== undefined) {
    const image = String(body.image).trim();
    if (image.length > 500) return { error: 'Image value must be 500 characters or fewer.' };
    payload.image = image;
  }

  if (body.available !== undefined) payload.available = Boolean(body.available);

  return { payload };
};

const logStockChange = async (item, delta, reason, by) => {
  try {
    if (!delta) return;
    await StockLog.create({
      item: item._id,
      name: item.name,
      category: item.category,
      delta,
      balance: Math.max(0, item.quantity),
      reason,
      by,
    });
  } catch (error) {
    console.warn('Stock log write failed:', error.message);
  }
};

const stockStatus = (quantity, threshold) => {
  if (quantity <= 0) return 'out';
  if (quantity < threshold) return 'low';
  return 'ok';
};

// @route   GET /api/inventory/stats
// @desc    Dashboard counters + the configured low-stock threshold (admin)
router.get('/stats', auth, adminMiddleware, async (req, res) => {
  try {
    const settings = await getSettings();
    const threshold = settings.stockThreshold;
    const [totalItems, lowStockCount, outOfStockCount] = await Promise.all([
      Inventory.countDocuments({ available: { $ne: false } }),
      Inventory.countDocuments({ quantity: { $lt: threshold }, available: { $ne: false } }),
      Inventory.countDocuments({ quantity: 0 }),
    ]);
    res.json({ threshold, totalItems, lowStockCount, outOfStockCount });
  } catch (error) {
    console.error('Inventory stats error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/inventory/log?page=&limit=
// @desc    Recent stock movements (admin)
router.get('/log', auth, adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const [entries, total] = await Promise.all([
      StockLog.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StockLog.countDocuments(),
    ]);
    res.json({ entries, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/inventory?search=&category=&status=&page=&limit=
// @desc    Inventory list with search/filter/pagination (admin)
router.get('/', auth, adminMiddleware, async (req, res) => {
  try {
    const settings = await getSettings();
    const threshold = settings.stockThreshold;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const filter = {};
    const search = String(req.query.search || '').trim();
    if (search) filter.name = new RegExp(escapeRegex(search), 'i');
    if (req.query.category && CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
    const status = req.query.status;
    if (status === 'low') filter.quantity = { $gt: 0, $lt: threshold };
    if (status === 'out') filter.quantity = 0;
    if (status === 'ok') filter.quantity = { $gte: threshold };
    if (req.query.available === 'false') filter.available = false;

    const [items, total] = await Promise.all([
      Inventory.find(filter)
        .sort({ category: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Inventory.countDocuments(filter),
    ]);

    res.json({
      items: items.map((item) => ({
        ...item,
        status: stockStatus(item.quantity, threshold),
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      threshold,
    });
  } catch (error) {
    console.error('Inventory list error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   POST /api/inventory
// @desc    Add new inventory item (admin)
router.post('/', auth, adminMiddleware, async (req, res) => {
  try {
    const { payload, error } = parsePayload(req.body);
    if (error) return res.status(400).json({ message: error });

    if (payload.category === undefined || payload.name === undefined) {
      return res.status(400).json({ message: 'Category and name are required.' });
    }

    const existing = await Inventory.findOne({ category: payload.category, name: payload.name });
    if (existing) {
      return res.status(400).json({ message: 'Item already exists in this category.' });
    }

    const item = await Inventory.create({
      ...payload,
      quantity: payload.quantity ?? 100,
      maxStock: payload.maxStock ?? Math.max(1, payload.quantity ?? 100),
      price: payload.price ?? 0,
      image: payload.image ?? '🍕',
    });
    await logStockChange(item, item.quantity, 'restock', req.user._id);
    res.status(201).json(item);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map((e) => e.message).join(' ');
      return res.status(400).json({ message });
    }
    console.error('Inventory create error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   PUT /api/inventory/:id
// @desc    Update inventory item (admin) — logs quantity changes
router.put('/:id', auth, adminMiddleware, async (req, res) => {
  try {
    const { payload, error } = parsePayload(req.body);
    if (error) return res.status(400).json({ message: error });

    const before = await Inventory.findById(req.params.id);
    if (!before) return res.status(404).json({ message: 'Item not found.' });

    const item = await Inventory.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    const delta = (item.quantity ?? 0) - (before.quantity ?? 0);
    await logStockChange(item, delta, 'manual-edit', req.user._id);
    res.json(item);
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      const message = error.name === 'ValidationError'
        ? Object.values(error.errors).map((e) => e.message).join(' ')
        : 'Invalid item id.';
      return res.status(400).json({ message });
    }
    console.error('Inventory update error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   POST /api/inventory/:id/restock
// @desc    Add stock (admin) — quantity must be a positive whole number
router.post('/:id/restock', auth, adminMiddleware, async (req, res) => {
  try {
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return res.status(400).json({ message: 'Restock quantity must be a whole number between 1 and 10000.' });
    }

    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      { $inc: { quantity } },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    // Keep maxStock at least as large as the balance so the bar stays sane.
    if (item.quantity > item.maxStock) {
      item.maxStock = item.quantity;
      await item.save();
    }

    await logStockChange(item, quantity, 'restock', req.user._id);
    res.json(item);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid item id.' });
    console.error('Restock error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   DELETE /api/inventory/:id
// @desc    Delete inventory item (admin)
router.delete('/:id', auth, adminMiddleware, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }
    res.json({ message: 'Item deleted successfully.' });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid item id.' });
    }
    console.error('Inventory delete error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
