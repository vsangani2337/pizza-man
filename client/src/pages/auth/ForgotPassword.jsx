import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../services/api';
import { toast } from 'react-toastify';
import './Auth.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      return toast.error('Please enter your email address');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return toast.error('Please enter a valid email address');
    }

    setLoading(true);
    try {
      await forgotPassword({ email: trimmedEmail });
      setSent(true);
      toast.success('Reset link sent! Check your inbox and spam folder.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page single-column">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">?</div>
          <h1>Forgot Password</h1>
          <p>Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div className="auth-success-state">
            <div className="auth-message success">
              If an account exists with <strong>{email}</strong>, a password reset link has been sent.
              <br /><br />
              <span className="auth-hint">
                ⚠️ Don't see it? Check your <strong>spam / junk</strong> folder.
              </span>
            </div>
            <div className="auth-links is-spaced-sm">
              <button
                className="auth-submit-btn auth-inline-btn"
                onClick={() => { setSent(false); setEmail(''); }}
              >
                Try a different email
              </button>
              <Link to="/login">Back to Login</Link>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="forgot-email">Email Address</label>
              <input
                id="forgot-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="auth-links is-spaced-lg">
              <Link to="/login">Back to Login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;