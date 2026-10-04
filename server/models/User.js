const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 30, default: 'Home' },
  line1: { type: String, trim: true, maxlength: 120, required: true },
  line2: { type: String, trim: true, maxlength: 120, default: '' },
  city: { type: String, trim: true, maxlength: 60, default: '' },
  pincode: { type: String, trim: true, maxlength: 10, default: '' },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 50,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20,
    default: '',
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  addresses: {
    type: [addressSchema],
    default: [],
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  verificationToken: String,
  verificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Exactly one default address.
userSchema.pre('validate', function (next) {
  if (Array.isArray(this.addresses) && this.addresses.length > 0) {
    const defaults = this.addresses.filter((a) => a.isDefault);
    if (defaults.length === 0) this.addresses[0].isDefault = true;
    if (defaults.length > 1) {
      defaults.slice(1).forEach((a) => { a.isDefault = false; });
    }
    if (this.addresses.length > 8) {
      return next(new Error('A maximum of 8 saved addresses is allowed.'));
    }
  }
  next();
});

userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
