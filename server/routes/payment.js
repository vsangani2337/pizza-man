const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const auth = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimit');
const {
  quoteItems,
  assertStock,
  decrementStock,
  PricingError,
} = require('../utils/pricing');
const checkStockAndAlert = require('../utils/stockAlert');

let razorpay;

const getRazorpay = () => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new PricingError(500, 'Payment gateway is not configured.');
    }
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpay;
};

const isSignatureValid = (orderId, paymentId, signature) => {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(signature || ''));
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const PHONE_REGEX = /^[6-9]\d{9}$/;

const validateCustomer = (raw) => {
  const name = String(raw?.name || '').trim();
  const phone = String(raw?.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const address = String(raw?.address || '').trim();

  if (name.length < 2 || name.length > 80) {
    throw new PricingError(400, 'A valid customer name is required.');
  }
  if (!PHONE_REGEX.test(phone)) {
    throw new PricingError(400, 'A valid 10-digit phone number is required.');
  }
  if (address.length < 5 || address.length > 300) {
    throw new PricingError(400, 'A delivery address of at least 5 characters is required.');
  }
  return { name, phone, address };
};

/** Maps server quotes → the Order.items snapshot. */
const toOrderItems = (quotes) =>
  quotes.map((quote) => {
    if (quote.customization) {
      return {
        type: quote.type,
        productId: quote.productId || null,
        name: quote.name,
        image: quote.image || '',
        size: quote.size || null,
        sizeName: quote.sizeName || null,
        customization: quote.customization,
        lines: quote.lines,
        quantity: quote.quantity,
        unitPrice: quote.unitTotal,
        subtotal: quote.subtotal,
      };
    }
    // Legacy Phase 1 payment records stored { pizza } / { drink } instead.
    const quantity = quote.quantity || 1;
    return {
      type: quote.type,
      productId: null,
      name: quote.type === 'drink' ? quote.drink?.name || 'Drink' : 'Custom Pizza',
      image: quote.image || '',
      size: null,
      sizeName: null,
      customization:
        quote.type === 'pizza' && quote.pizza
          ? { ...quote.pizza, addons: [], size: 'medium', sizeName: 'Medium' }
          : null,
      lines: quote.lines || [],
      quantity,
      unitPrice: quote.unitTotal ?? (quote.subtotal || 0) / quantity,
      subtotal: quote.subtotal,
    };
  });

// @route   POST /api/payment/quote
// @desc    Server-priced quote. Prices always come from MongoDB.
router.post('/quote', auth, async (req, res) => {
  try {
    const quoted = await quoteItems(req.body.items);
    res.json(quoted);
  } catch (error) {
    if (error instanceof PricingError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Quote error:', error);
    res.status(500).json({ message: 'Unable to price the order.' });
  }
});

// @route   POST /api/payment/create-order
// @desc    Create a Razorpay order for a SERVER-CALCULATED multi-item cart
router.post('/create-order', paymentLimiter, auth, async (req, res) => {
  try {
    const items = req.body?.items;

    if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
      return res.status(400).json({ message: 'Your cart must contain between 1 and 20 items.' });
    }

    const customer = validateCustomer(req.body?.customer);
    const quoted = await quoteItems(items);

    const store = quoted.store || {};
    if (store.storeOpen === false) {
      return res.status(403).json({ message: 'The store is currently closed. Please try again later.' });
    }
    if (store.deliveryEnabled === false) {
      return res.status(403).json({ message: 'Delivery is not available right now. Please try again later.' });
    }
    if (store.minOrderAmount > 0 && quoted.summary.subtotal < store.minOrderAmount) {
      return res.status(400).json({
        message: `Minimum order amount is ₹${store.minOrderAmount}. Add ₹${(store.minOrderAmount - quoted.summary.subtotal).toFixed(2)} more to checkout.`,
      });
    }

    await assertStock(quoted.quotes);

    const amount = Math.round(quoted.summary.total * 100);
    if (!Number.isInteger(amount) || amount < 100) {
      return res.status(400).json({ message: 'Order total must be at least ₹1.00.' });
    }

    const order = await getRazorpay().orders.create({
      amount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { userId: String(req.user._id), items: String(quoted.quotes.length) },
    });

    await Payment.create({
      user: req.user._id,
      razorpayOrderId: order.id,
      amount,
      currency: order.currency || 'INR',
      items: quoted.quotes,
      customer,
      pricing: quoted.summary,
      status: 'created',
    });

    res.json(order);
  } catch (error) {
    if (error instanceof PricingError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Razorpay create order error:', error);
    res.status(500).json({ message: 'Error creating payment order.' });
  }
});

// @route   POST /api/payment/verify
// @desc    Verify signature, record the order idempotently, deduct stock
router.post('/verify', paymentLimiter, auth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Missing payment verification details.' });
  }

  if (!isSignatureValid(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return res.status(400).json({ message: 'Payment verification failed.' });
  }

  try {
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });

    if (!payment) {
      console.error(`CRITICAL: verified payment ${razorpay_payment_id} has no matching payment record.`);
      return res.status(404).json({
        message: 'Payment session not found. Please contact support with your payment id.',
      });
    }

    if (String(payment.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'This payment does not belong to your account.' });
    }

    // Already fully recorded — safe to call again (idempotent).
    if (payment.status === 'paid' && payment.orderId) {
      const existing = await Order.findById(payment.orderId).populate('user', 'name email');
      if (existing) {
        return res.json({ message: 'Order already recorded.', order: existing, duplicate: true });
      }
    }

    // Order exists but the payment record failed to update — finish the bookkeeping only.
    if (payment.orderId) {
      payment.status = 'paid';
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      await payment.save();
      const existing = await Order.findById(payment.orderId).populate('user', 'name email');
      return res.json({ message: 'Order recorded.', order: existing, duplicate: true });
    }

    const quotes = Array.isArray(payment.items) ? payment.items : [payment.items];
    const summary = payment.pricing;

    const order = await Order.create({
      user: payment.user,
      orderNumber: undefined, // generated in pre-save hook
      items: toOrderItems(quotes),
      customer: payment.customer || undefined,
      subtotal: summary.subtotal,
      deliveryFee: summary.deliveryFee,
      tax: summary.tax,
      discount: summary.discount || 0,
      totalPrice: summary.total,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentStatus: 'paid',
      status: 'Order Placed',
      // Legacy fields: keep a representative first item so older clients work.
      type: quotes[0]?.type || 'pizza',
      quantity: quotes.reduce((sum, q) => sum + (q.quantity || 1), 0),
      pizza: quotes[0]?.type === 'pizza' ? quotes[0]?.customization || quotes[0]?.pizza : undefined,
      drink:
        quotes[0]?.type === 'drink'
          ? { name: quotes[0]?.customization ? quotes[0].name : quotes[0]?.drink?.name }
          : undefined,
    });

    payment.status = 'paid';
    payment.orderId = order._id;
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    await payment.save();

    // Stock and alerts must never roll back a captured payment.
    try {
      await decrementStock(quotes);
    } catch (error) {
      console.error('Stock decrement failed (payment already captured):', error.message);
    }

    try {
      await checkStockAndAlert();
    } catch (error) {
      console.error('Stock alert failed (payment already captured):', error.message);
    }

    const populatedOrder = await Order.findById(order._id).populate('user', 'name email');
    res.status(201).json({ message: 'Order placed successfully!', order: populatedOrder });
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({
      message:
        'Your payment was captured but the order could not be recorded. ' +
        'Please press "Retry confirmation" — you will not be charged again.',
    });
  }
});

module.exports = router;
