import { useState } from 'react';
import { Link } from 'react-router-dom';
import { registerUser, resendVerification } from '../../services/api';
import { validatePassword } from '../../utils/validation';
import { toast } from 'react-toastify';
import './Auth.css';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendState, setResendState] = useState('idle');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      return toast.error(passwordError);
    }
    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setLoading(true);
    try {
      const { data } = await registerUser({ name: form.name, email: form.email, password: form.password });
      toast.success(data.message);
      setSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendState('sending');
    try {
      const { data } = await resendVerification(form.email);
      toast.success(data.message || 'Verification email sent');
      setResendState('sent');
    } catch (err) {
      setResendState('idle');
      toast.error(err.response?.data?.message || 'Could not send the email');
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-decorative">
          <h2 className="auth-tagline">Welcome to the family.</h2>
          <p className="auth-tagline-subtitle">We're thrilled to have you here.</p>
        </div>
        <div className="auth-card">
          <div className="auth-logo">
            <h1>Check Your Email</h1>
            <p>We've sent a verification link to <strong>{form.email}</strong></p>
          </div>
          <div className="auth-message success">
            Didn't see it? Check your <strong>spam / junk</strong> folder, or send it again.
          </div>
          <div className="auth-links is-spaced-lg">
            <button
              type="button"
              className="auth-resend-btn"
              onClick={handleResend}
              disabled={resendState !== 'idle'}
            >
              {resendState === 'sending'
                ? 'Sending…'
                : resendState === 'sent'
                  ? 'Email sent ✓'
                  : 'Resend verification email'}
            </button>
          </div>
          <div className="auth-links is-spaced-sm">
            <Link to="/login">Return to login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-decorative">
        <h2 className="auth-tagline">Start your order.</h2>
        <p className="auth-tagline-subtitle">Create an account to save your delivery addresses.</p>
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">P</div>
          <h1>Create Account</h1>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-input"
              placeholder="Enter your full name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              name="email"
              type="email"
              className="form-input"
              placeholder="Enter your email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              name="password"
              type="password"
              className="form-input"
              placeholder="Min. 8 characters with a letter & number"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-divider">or</div>
        <div className="auth-links">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;