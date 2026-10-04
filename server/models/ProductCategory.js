const mongoose = require('mongoose');

const productCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 60,
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    maxlength: 60,
  },
  active: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

productCategorySchema.pre('validate', function (next) {
  if (this.name && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  next();
});

module.exports = mongoose.model('ProductCategory', productCategorySchema);
