// Mirrors the server-side password rules (server/utils/validate.js) so users get
// the same message in the form instead of a 400 after submitting.
export const validatePassword = (password) => {
  if (typeof password !== 'string' || !password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
};
