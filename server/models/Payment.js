const mongoose = require('mongoose');

/**
 * Records a payment attempt created for Razorpay *before* the customer pays.
 * It stores the authoritative server-priced snapshot so that:
 *  - the amount can never be tampered with by the client,
 *  - a successful payment is never silently lost,
 *  - verification can be retried idempotently without creating duplicates.
 */
const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  items: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  customer: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  pricing: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  status: {
    type: String,
    enum: ['created', 'paid', 'failed'],
    default: 'created',
    index: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  razorpayPaymentId: String,
  razorpaySignature: String,
  failureReason: String,
}, {
  timestamps: true,
});

module.exports = mongoose.model('Payment', paymentSchema);
