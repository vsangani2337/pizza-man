const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { getSettings } = require('../utils/settings');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

const parseDate = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const toDateKey = (date) => date.toISOString().slice(0, 10);

const fillDailySeries = (from, to, grouped) => {
  const map = new Map(grouped.map((entry) => [entry._id, entry]));
  const series = [];
  for (let day = new Date(from); day <= to; day = new Date(day.getTime() + DAY_MS)) {
    const key = toDateKey(day);
    const found = map.get(key);
    series.push({ date: key, revenue: found ? found.revenue : 0, orders: found ? found.orders : 0 });
  }
  return series;
};

// @route   GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
// @desc    Server-side dashboard analytics (default: last 30 days)
router.get('/', auth, adminMiddleware, async (req, res) => {
  try {
    const settings = await getSettings();
    const to = parseDate(req.query.to, new Date());
    const from = parseDate(req.query.from, new Date(to.getTime() - 29 * DAY_MS));
    to.setUTCHours(23, 59, 59, 999);

    if (from > to) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }
    if ((to - from) / DAY_MS > MAX_RANGE_DAYS) {
      return res.status(400).json({ message: 'Date range cannot exceed one year.' });
    }

    const range = { createdAt: { $gte: from, $lte: to } };
    const nonCancelled = { ...range, status: { $ne: 'Cancelled' } };

    const [revenueAgg, statusBreakdown, dailyAgg, totalCustomers, allTime, lowStockCount, topProducts, topToppings] =
      await Promise.all([
        Order.aggregate([
          { $match: nonCancelled },
          { $group: { _id: null, revenue: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
        ]),
        Order.aggregate([
          { $match: range },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Order.aggregate([
          { $match: nonCancelled },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              revenue: { $sum: '$totalPrice' },
              orders: { $sum: 1 },
            },
          },
        ]),
        User.countDocuments({ role: 'user' }),
        Order.aggregate([
          { $group: { _id: null, orders: { $sum: 1 } } },
        ]),
        Inventory.countDocuments({
          quantity: { $lt: settings.stockThreshold },
          available: { $ne: false },
        }),
        Order.aggregate([
          { $match: nonCancelled },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.name',
              qty: { $sum: '$items.quantity' },
              revenue: { $sum: '$items.subtotal' },
            },
          },
          { $sort: { qty: -1 } },
          { $limit: 5 },
        ]),
        Order.aggregate([
          { $match: nonCancelled },
          { $unwind: '$items' },
          { $unwind: { path: '$items.customization.veggies', preserveNullAndEmptyArrays: false } },
          { $group: { _id: '$items.customization.veggies', qty: { $sum: 1 } } },
          { $sort: { qty: -1 } },
          { $limit: 6 },
        ]),
      ]);

    const statusMap = Object.fromEntries(statusBreakdown.map((entry) => [entry._id, entry.count]));

    res.json({
      range: { from: toDateKey(from), to: toDateKey(to) },
      totals: {
        revenue: revenueAgg[0]?.revenue || 0,
        orders: revenueAgg[0]?.orders || 0,
        customers: totalCustomers,
        pending: (statusMap['Order Placed'] || 0) + (statusMap['Order Received'] || 0) + (statusMap['In the Kitchen'] || 0) + (statusMap['Sent to Delivery'] || 0),
        completed: statusMap['Delivered'] || 0,
        cancelled: statusMap['Cancelled'] || 0,
        allTimeOrders: allTime[0]?.orders || 0,
        lowStock: lowStockCount,
        stockThreshold: settings.stockThreshold,
      },
      statusBreakdown: statusMap,
      series: fillDailySeries(from, to, dailyAgg),
      topProducts: topProducts.map((entry) => ({ name: entry._id, qty: entry.qty, revenue: entry.revenue })),
      topToppings: topToppings.map((entry) => ({ name: entry._id, qty: entry.qty })),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
