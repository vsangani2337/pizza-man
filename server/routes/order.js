const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { restoreStock } = require('../utils/pricing');

const MAX_LIMIT = 50;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Allowed forward transitions (admin). Cancelled is terminal.
const STATUS_FLOW = ['Order Placed', 'Order Received', 'In the Kitchen', 'Sent to Delivery', 'Delivered'];
const VALID_STATUSES = [...STATUS_FLOW, 'Cancelled'];

const allowedNextStatuses = (current) => {
  switch (current) {
    case 'Order Placed': return ['Order Received', 'Cancelled'];
    case 'Order Received': return ['In the Kitchen', 'Cancelled'];
    case 'In the Kitchen': return ['Sent to Delivery'];
    case 'Sent to Delivery': return ['Delivered'];
    default: return []; // Delivered / Cancelled are terminal
  }
};

const parseDate = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

// @route   GET /api/orders/my-orders
// @desc    Get current user's orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/orders?search=&status=&paymentStatus=&from=&to=&page=&limit=
// @desc    Admin: orders with search, filters, date range, pagination
router.get('/', auth, adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const filter = {};
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (req.query.paymentStatus && ['pending', 'paid', 'failed'].includes(req.query.paymentStatus)) {
      filter.paymentStatus = req.query.paymentStatus;
    }

    const from = parseDate(req.query.from, null);
    const to = parseDate(req.query.to, null);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) {
        to.setUTCHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const search = String(req.query.search || '').trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      const or = [
        { orderNumber: regex },
        { 'customer.name': regex },
        { 'customer.phone': regex },
        { 'customer.address': regex },
      ];
      // Also match the account name/e-mail via a cheap pre-query.
      const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').limit(50).lean();
      if (users.length > 0) or.push({ user: { $in: users.map((u) => u._id) } });
      filter.$or = or;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    res.json({
      orders,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      statusFlow: STATUS_FLOW,
    });
  } catch (error) {
    console.error('Orders list error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status (admin) — enforces valid forward transitions
router.put('/:id/status', auth, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (order.status === status) {
      return res.json(order);
    }

    const allowed = allowedNextStatuses(order.status);
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot move from "${order.status}" to "${status}". Allowed: ${allowed.join(', ') || 'none'}.`,
      });
    }

    order.status = status;
    await order.save();
    const populated = await Order.findById(order._id).populate('user', 'name email');
    res.json(populated);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid order id.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   POST /api/orders/:id/cancel
// @desc    Customer cancels their own order (only while still 'Order Placed')
//          and best-effort restores ingredient stock.
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    if (String(order.user) !== String(req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ message: 'You can only cancel your own orders.' });
    }
    if (order.status === 'Cancelled') {
      return res.json({ message: 'Order already cancelled.', order });
    }
    if (order.status !== 'Order Placed') {
      return res
        .status(400)
        .json({ message: `This order can no longer be cancelled (status: ${order.status}).` });
    }

    order.status = 'Cancelled';
    await order.save();

    if (Array.isArray(order.items) && order.items.length > 0) {
      try {
        await restoreStock(order.items);
      } catch (error) {
        console.error('Stock restore failed for cancelled order:', error.message);
      }
    }

    const populated = await Order.findById(order._id).populate('user', 'name email');
    res.json({ message: 'Order cancelled.', order: populated });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid order id.' });
    }
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
