const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const MAX_LIMIT = 50;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || '',
  role: user.role,
  isActive: user.isActive !== false,
  isVerified: Boolean(user.isVerified),
  createdAt: user.createdAt,
  addressCount: Array.isArray(user.addresses) ? user.addresses.length : 0,
});

// @route   GET /api/users?search=&role=&status=&page=&limit=
// @desc    Admin: list customers with search/filter/pagination
router.get('/', auth, adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const search = String(req.query.search || '').trim();

    const filter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }
    if (req.query.role === 'admin' || req.query.role === 'user') filter.role = req.query.role;
    if (req.query.status === 'active') filter.isActive = true;
    if (req.query.status === 'disabled') filter.isActive = false;
    if (req.query.verified === 'true') filter.isVerified = true;
    if (req.query.verified === 'false') filter.isVerified = false;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email phone role isActive isVerified createdAt addresses')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users: users.map(publicUser),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/users/:id
// @desc    Admin: user detail + order statistics
router.get('/:id', auth, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name email phone role isActive isVerified createdAt addresses')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const stats = await Order.aggregate([
      { $match: { user: user._id, status: { $ne: 'Cancelled' } } },
      { $group: { _id: null, orders: { $sum: 1 }, spent: { $sum: '$totalPrice' } } },
    ]);

    const recentOrders = await Order.find({ user: user._id })
      .select('orderNumber status totalPrice paymentStatus createdAt items')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      user: publicUser(user),
      addresses: user.addresses || [],
      stats: { orders: stats[0]?.orders || 0, spent: stats[0]?.spent || 0 },
      recentOrders: recentOrders.map((order) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalPrice: order.totalPrice,
        createdAt: order.createdAt,
        itemCount: Array.isArray(order.items) ? order.items.length : 1,
      })),
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid user id.' });
    console.error('User detail error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/users/:id/orders
// @desc    Admin: full order history for one user
router.get('/:id/orders', auth, adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filter = { user: req.params.id };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ orders, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid user id.' });
    console.error('User orders error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   PUT /api/users/:id
// @desc    Admin: enable/disable account or change role
router.put('/:id', auth, adminMiddleware, async (req, res) => {
  try {
    if (String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ message: 'You cannot change your own account here.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const { isActive, role } = req.body || {};
    const updates = {};

    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (role !== undefined) {
      if (role !== 'user' && role !== 'admin') {
        return res.status(400).json({ message: 'Invalid role.' });
      }
      // Never demote the last remaining admin.
      if (user.role === 'admin' && role === 'user') {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Cannot demote the last active admin.' });
        }
      }
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nothing to update.' });
    }

    Object.assign(user, updates);
    await user.save();

    res.json({ user: publicUser(user) });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid user id.' });
    console.error('User update error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
