const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateName = (name) => {
  const value = String(name ?? '').trim();
  if (!value) return 'Name is required.';
  if (value.length < 2) return 'Name must be at least 2 characters.';
  if (value.length > 50) return 'Name must be 50 characters or fewer.';
  return null;
};

const validateEmail = (email) => {
  const value = String(email ?? '').trim();
  if (!value) return 'Email is required.';
  if (value.length > 254) return 'Email must be 254 characters or fewer.';
  if (!EMAIL_RE.test(value)) return 'Please provide a valid email address.';
  return null;
};

const validatePassword = (password) => {
  if (typeof password !== 'string' || !password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
};

const validatePositiveNumber = (value, label) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return `${label} must be a number.`;
  if (num < 0) return `${label} cannot be negative.`;
  return null;
};

const validateInteger = (value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const num = Number(value);
  if (!Number.isInteger(num)) return `${label} must be a whole number.`;
  if (num < min) return `${label} must be at least ${min}.`;
  if (num > max) return `${label} must be ${max} or fewer.`;
  return null;
};

const pickFirst = (...errors) => errors.find(Boolean) || null;

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

module.exports = {
  EMAIL_RE,
  validateName,
  validateEmail,
  validatePassword,
  validatePositiveNumber,
  validateInteger,
  pickFirst,
  escapeHtml,
};
