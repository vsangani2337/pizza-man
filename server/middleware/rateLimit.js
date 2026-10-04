const { rateLimit } = require('express-rate-limit');

const build = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message },
  });

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

module.exports = {
  loginLimiter: build(15 * MINUTE, 20, 'Too many login attempts. Please wait 15 minutes and try again.'),
  registerLimiter: build(HOUR, 5, 'Too many accounts created from this device. Please try again in an hour.'),
  forgotLimiter: build(HOUR, 5, 'Too many password reset requests. Please try again in an hour.'),
  resetLimiter: build(HOUR, 10, 'Too many password reset attempts. Please try again in an hour.'),
  verifyLimiter: build(HOUR, 10, 'Too many verification requests. Please try again in an hour.'),
  paymentLimiter: build(15 * MINUTE, 30, 'Too many payment attempts. Please wait a few minutes and try again.'),
};
