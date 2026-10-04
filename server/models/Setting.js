const mongoose = require('mongoose');

/**
 * Store-wide settings kept in the database (single document).
 * Values fall back to the environment variables in utils/settings.js,
 * so existing deployments keep working without a migration.
 */
const settingSchema = new mongoose.Schema({
  key: { type: String, default: 'store', unique: true },
  taxRate: { type: Number, min: 0, max: 100, default: 0 },
  deliveryFee: { type: Number, min: 0, default: 0 },
  freeDeliveryAbove: { type: Number, min: 0, default: 0 },
  minOrderAmount: { type: Number, min: 0, default: 0 },
  stockThreshold: { type: Number, min: 0, default: 20 },
  storeOpen: { type: Boolean, default: true },
  deliveryEnabled: { type: Boolean, default: true },
  storeName: { type: String, trim: true, maxlength: 60, default: 'Pizza Man' },
  supportPhone: { type: String, trim: true, maxlength: 20, default: '' },
  supportEmail: { type: String, trim: true, maxlength: 100, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
