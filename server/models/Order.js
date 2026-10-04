const mongoose = require('mongoose');
const crypto = require('crypto');

// One priced line of an order. `customization` + `unitPrice` are snapshots
// taken at purchase time — later price/stock changes never mutate history.
const orderItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['pizza', 'drink'],
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  image: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: null,
  },
  sizeName: {
    type: String,
    default: null,
  },
  customization: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  lines: {
    type: [mongoose.Schema.Types.Mixed],
    default: undefined,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 50,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  orderNumber: {
    type: String,
    unique: true,
    sparse: true,
  },

  // ---- v2 (multi-item) ----
  items: {
    type: [orderItemSchema],
    default: undefined,
  },
  customer: {
    name: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 20 },
    address: { type: String, trim: true, maxlength: 300 },
  },

  // ---- legacy (single-item) kept so Phase 1 orders still render ----
  type: {
    type: String,
    enum: ['pizza', 'drink'],
    default: 'pizza',
  },
  pizza: {
    base: { type: String, trim: true },
    sauce: { type: String, trim: true },
    cheese: { type: String, trim: true },
    veggies: [{ type: String }],
  },
  drink: {
    name: { type: String, trim: true },
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1,
    max: 50,
  },

  subtotal: {
    type: Number,
    required: true,
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: 0,
  },
  tax: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  razorpaySignature: {
    type: String,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'paid',
  },
  status: {
    type: String,
    enum: [
      'Order Placed',
      'Order Received',
      'In the Kitchen',
      'Sent to Delivery',
      'Delivered',
      'Cancelled',
    ],
    default: 'Order Placed',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

const PHONE_REGEX = /^[6-9]\d{9}$/;

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

orderSchema.pre('validate', function (next) {
  // v2 orders: one or many priced items + customer details.
  if (Array.isArray(this.items) && this.items.length > 0) {
    for (const [index, item] of this.items.entries()) {
      if (!item.name) this.invalidate(`items.${index}.name`, 'Item name is required.');
      if (item.quantity < 1 || item.quantity > 50) {
        this.invalidate(`items.${index}.quantity`, 'Quantity must be between 1 and 50.');
      }
      if (item.unitPrice < 0) this.invalidate(`items.${index}.unitPrice`, 'Invalid unit price.');
      if (item.type === 'pizza' && !(item.customization && item.customization.base)) {
        this.invalidate(`items.${index}.customization`, 'Pizza customization is required.');
      }
      if (item.type === 'drink' && item.customization) {
        // drinks carry no customization — normalise rather than fail
        item.customization = null;
      }
    }

    const customer = this.customer || {};
    if (!customer.name || !String(customer.name).trim()) {
      this.invalidate('customer.name', 'Customer name is required.');
    }
    if (!PHONE_REGEX.test(normalizePhone(customer.phone))) {
      this.invalidate('customer.phone', 'A valid 10-digit phone number is required.');
    }
    if (!customer.address || String(customer.address).trim().length < 5) {
      this.invalidate('customer.address', 'Delivery address is required.');
    }
    next();
    return;
  }

  // Legacy single-item orders.
  if (this.type === 'drink') {
    if (!this.drink || !this.drink.name) {
      this.invalidate('drink.name', 'Drink name is required.');
    }
  } else {
    if (!this.pizza || !this.pizza.base) this.invalidate('pizza.base', 'Base is required.');
    if (!this.pizza || !this.pizza.sauce) this.invalidate('pizza.sauce', 'Sauce is required.');
    if (!this.pizza || !this.pizza.cheese) this.invalidate('pizza.cheese', 'Cheese is required.');
  }
  next();
});

orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    this.orderNumber = `PM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  next();
});

// Cancelled orders can never move through the kitchen pipeline again.
orderSchema.methods.canBeCancelled = function () {
  return this.status === 'Order Placed';
};

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
