const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Product = require('../models/Product');
const sendEmail = require('../utils/sendEmail');
const auth = require('../middleware/auth');
const {
  validateName,
  validateEmail,
  validatePassword,
  escapeHtml,
  pickFirst,
} = require('../utils/validate');
const {
  loginLimiter,
  registerLimiter,
  forgotLimiter,
  resetLimiter,
  verifyLimiter,
} = require('../middleware/rateLimit');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

const buildVerifyEmail = (name, verifyUrl) => `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #FFFFFF; color: #2B1A12; border-radius: 16px; overflow: hidden; border: 1px solid rgba(43, 26, 18, 0.08);">
  <div style="background: linear-gradient(135deg, #E8593F, #C23F28); padding: 32px; text-align: center;">
    <h1 style="margin: 0; color: #FFF9F2; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 700;">🍕 Welcome to Pizza Man!</h1>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 16px; margin: 0 0 12px;">Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p style="margin: 0 0 8px;">Thanks for signing up! Click the button below to verify your email address:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verifyUrl}" style="background: linear-gradient(135deg, #E8593F, #C23F28); color: #FFF9F2; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: 700; font-size: 16px; display: inline-block;">Verify Email</a>
    </div>
    <p style="color: #7A6656; font-size: 13px; margin: 0;">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
  </div>
</div>`;

// @route   POST /api/auth/register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    const validationError = pickFirst(
      validateName(name),
      validateEmail(email),
      validatePassword(password)
    );
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const normalizedEmail = normalizeEmail(email);

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      isVerified: false,
      verificationToken,
      verificationExpires,
    });

    try {
      const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
      await sendEmail({
        to: user.email,
        subject: '🍕 Verify Your Email — Pizza Man',
        html: buildVerifyEmail(user.name, verifyUrl),
      });
      console.log('✅ Verification email sent');
    } catch (emailError) {
      console.warn('⚠️ Email sending failed:', emailError.message);
    }

    res.status(201).json({
      message: 'Registration successful! Check your email to verify your account, then log in.',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map((e) => e.message).join(' ');
      return res.status(400).json({ message });
    }
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// @route   GET /api/auth/verify-email/:token
// @desc    Verify email — safe to call more than once with the same link
router.get('/verify-email/:token', verifyLimiter, async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification link.' });
    }

    // Idempotent: a second click on the same link reports success instead of failing.
    if (user.isVerified) {
      return res.json({ message: 'Email already verified! You can now log in.' });
    }

    if (!user.verificationExpires || user.verificationExpires.getTime() < Date.now()) {
      return res.status(400).json({
        message: 'This verification link has expired. Request a new one below.',
        expired: true,
      });
    }

    // Mark verified but KEEP the token: email scanners and double clicks hit
    // this route again, and the isVerified check above must still find the user.
    user.isVerified = true;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ message: 'Server error during verification.' });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Re-send the verification email (never reveals whether the account exists)
router.post('/resend-verification', verifyLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    const validationError = validateEmail(email);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const genericResponse = {
      message: 'If that account is unverified, a new verification link has been sent.',
    };

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user || user.isVerified) {
      return res.json(genericResponse);
    }

    user.verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    try {
      const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${user.verificationToken}`;
      await sendEmail({
        to: user.email,
        subject: '🍕 Verify Your Email — Pizza Man',
        html: buildVerifyEmail(user.name, verifyUrl),
      });
    } catch (emailError) {
      console.warn('⚠️ Verification email failed:', emailError.message);
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'This account has been disabled. Please contact support.' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// @route   POST /api/auth/forgot-password
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    const validationError = validateEmail(email);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const genericResponse = {
      message: 'If an account exists with this email, a reset link has been sent.',
    };

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    try {
      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
      await sendEmail({
        to: user.email,
        subject: '🔑 Reset Your Password — Pizza Man',
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 16px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #ff6b35, #ff8c42); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #fff; font-size: 28px;">🔑 Password Reset</h1>
            </div>
            <div style="padding: 32px;">
              <p>You requested a password reset. Click the button below:</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #ff6b35, #ff8c42); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #888; font-size: 13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      // Never leak transport failures to the client (prevents account enumeration).
      console.error('Reset email failed:', emailError.message);
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   POST /api/auth/reset-password/:token
router.post('/reset-password/:token', resetLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body || {};

    const validationError = validatePassword(password);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset link.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map((e) => e.message).join(' ');
      return res.status(400).json({ message });
    }
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// ---- Profile ---------------------------------------------------------------

const PHONE_LAX = /^[6-9]\d{9}$/;

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

const sanitizeAddresses = (raw) => {
  if (!Array.isArray(raw)) return { error: 'Addresses must be a list.' };
  if (raw.length > 8) return { error: 'A maximum of 8 saved addresses is allowed.' };

  const addresses = [];
  for (const [index, entry] of raw.entries()) {
    const line1 = String(entry?.line1 || '').trim();
    const label = String(entry?.label || 'Home').trim().slice(0, 30) || 'Home';
    const line2 = String(entry?.line2 || '').trim().slice(0, 120);
    const city = String(entry?.city || '').trim().slice(0, 60);
    const pincode = String(entry?.pincode || '').replace(/[^\d-]/g, '').slice(0, 10);
    if (line1.length < 3 || line1.length > 120) {
      return { error: `Address ${index + 1}: street must be 3–120 characters.` };
    }
    addresses.push({ label, line1, line2, city, pincode, isDefault: Boolean(entry?.isDefault) });
  }
  if (addresses.length > 0 && !addresses.some((a) => a.isDefault)) {
    addresses[0].isDefault = true;
  }
  return { addresses };
};

// @route   GET /api/auth/profile
// @desc    Full profile: name, phone, addresses, favorites
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('name email phone role isVerified isActive createdAt addresses favorites')
      .populate('favorites', 'name price image description available')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
      addresses: user.addresses || [],
      favorites: user.favorites || [],
    });
  } catch (error) {
    console.error('Profile read error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update name / phone
router.put('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const updates = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 50) {
        return res.status(400).json({ message: 'Name must be 2–50 characters.' });
      }
      updates.name = name;
    }
    if (req.body?.phone !== undefined) {
      const phone = normalizePhone(req.body.phone);
      if (phone && !PHONE_LAX.test(phone)) {
        return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });
      }
      updates.phone = phone;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nothing to update.' });
    }

    Object.assign(user, updates);
    await user.save();

    res.json({
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors).map((e) => e.message).join(' ') });
    }
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   PUT /api/auth/addresses
// @desc    Replace the saved address book (validated, one default)
router.put('/addresses', auth, async (req, res) => {
  try {
    const { addresses, error } = sanitizeAddresses(req.body?.addresses);
    if (error) return res.status(400).json({ message: error });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.addresses = addresses;
    await user.save();

    res.json({ addresses: user.addresses });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors).map((e) => e.message).join(' ') });
    }
    console.error('Addresses update error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change password (requires the current one)
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const policyError = validatePassword(newPassword);
    if (policyError) return res.status(400).json({ message: policyError });
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ message: 'Current password is required.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({ message: 'New password must differ from the current one.' });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors).map((e) => e.message).join(' ') });
    }
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/auth/favorites
// @desc    Current user's favourite products
router.get('/favorites', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('favorites')
      .populate('favorites', 'name price image description available');
    res.json(user.favorites || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   POST /api/auth/favorites/:productId
// @desc    Toggle a product in the favourites list
router.post('/favorites/:productId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const product = await Product.findById(req.params.productId).select('_id available');
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    const id = String(product._id);
    const index = user.favorites.findIndex((entry) => String(entry) === id);
    let favorited;
    if (index >= 0) {
      user.favorites.splice(index, 1);
      favorited = false;
    } else {
      user.favorites.push(id);
      favorited = true;
    }
    await user.save();
    res.json({ favorited, count: user.favorites.length });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid product id.' });
    console.error('Favorites error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
