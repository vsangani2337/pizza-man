const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['base', 'sauce', 'cheese', 'veggie', 'meat', 'drink', 'addon'],
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  quantity: {
    type: Number,
    required: true,
    default: 100,
    min: 0,
  },
  // Reference value used to render the stock health bar in the admin UI.
  maxStock: {
    type: Number,
    required: true,
    default: 100,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  image: {
    type: String,
    default: '🍕',
    maxlength: 500,
  },
  // Temporarily hide an ingredient/drink/add-on without deleting it.
  available: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

inventorySchema.index({ category: 1, name: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
