const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const auth = require('../middleware/auth');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); 

    const user = await User.create({
      name,
      email,
      password,
      isVerified: false, 
      verificationToken,
      verificationExpires,
    });

    try {
      const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
      await sendEmail({
        to: email,
        subject: '🍕 Verify Your Email — Pizzara',
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 16px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #ff6b35, #ff8c42); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #fff; font-size: 28px;">🍕 Welcome to Pizzara!</h1>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px;">Hi <strong>${name}</strong>,</p>
              <p>Thanks for signing up! Click the button below to verify your email address:</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${verifyUrl}" style="background: linear-gradient(135deg, #ff6b35, #ff8c42); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Verify Email</a>
              </div>
              <p style="color: #888; font-size: 13px;">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
            </div>
          </div>
        `,
      });
      console.log('✅ Verification email sent');
    } catch (emailError) {
      console.warn('⚠️ Email sending failed:', emailError.message);
    }

    res.status(201).json({
      message: 'Registration successful! You can now log in.',
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification link.' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ message: 'Server error during verification.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
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

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendEmail({
      to: email,
      subject: '🔑 Reset Your Password — Pizzara',
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

    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password using token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

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
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
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

module.exports = router;
