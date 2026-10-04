const mongoose = require('mongoose');

// A preset product (e.g. a signature pizza) with its own server-side price.
// `pizza` holds the ingredient composition used for stock checks + reorder.
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 80,
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: 300,
  },
  // Client asset key (e.g. "margherita") — resolved by the frontend, or a full URL.
  image: {
    type: String,
    trim: true,
    default: '',
  },
  category: {
    type: String,
    enum: ['pizza'],
    default: 'pizza',
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductCategory',
    default: null,
    index: true,
  },
  price: {
    type: Number,
    required: true,
    min: 1,
  },
  available: {
    type: Boolean,
    default: true,
  },
  pizza: {
    base: { type: String, required: true, trim: true },
    sauce: { type: String, required: true, trim: true },
    cheese: { type: String, required: true, trim: true },
    veggies: [{ type: String, trim: true }],
  },
}, { timestamps: true });

productSchema.index({ category: 1, available: 1 });

module.exports = mongoose.model('Product', productSchema);
