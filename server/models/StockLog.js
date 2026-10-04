const mongoose = require('mongoose');

/** Audit trail for inventory quantity changes (restocks + manual edits). */
const stockLogSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  delta: { type: Number, required: true },
  balance: { type: Number, required: true, min: 0 },
  reason: {
    type: String,
    enum: ['restock', 'manual-edit', 'order-deduction', 'order-cancel-restore'],
    default: 'manual-edit',
  },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

stockLogSchema.index({ createdAt: -1 });
stockLogSchema.index({ item: 1, createdAt: -1 });

module.exports = mongoose.model('StockLog', stockLogSchema);
