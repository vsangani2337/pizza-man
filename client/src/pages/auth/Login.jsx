import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginUser, resendVerification } from '../../services/api';
import { toast } from 'react-toastify';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendState, setResendState] = useState('idle');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await loginUser({ email, password });
      login(data.token, data.user);
      toast.success('Welcome back!', { autoClose: 2000 });
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      const payload = err.response?.data;
      if (err.response?.status === 403 && payload?.requiresVerification) {
        setUnverified(true);
        setResendState('idle');
        toast.error(payload.message || 'Please verify your email first');
      } else {
        toast.error(payload?.message || 'Login failed', { autoClose: 2000 });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendState('sending');
    try {
      const { data } = await resendVerification(email.trim());
      toast.success(data.message || 'Verification email sent');
      setResendState('sent');
    } catch (err) {
      setResendState('idle');
      toast.error(err.response?.data?.message || 'Could not send the email');
    }
  };

  return (
    <div className="auth-page">
      {/* LEFT SIDE */}
      <div className="auth-decorative">
        <h2 className="auth-tagline">Straight from the oven to<br />your door.</h2>
        <p className="auth-tagline-subtitle">Track your delivery live, reorder your favorites in one tap, and earn a free slice along the way.</p>
      </div>

      {/* RIGHT SIDE */}
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Pizza Man</h1>
          <p>Welcome back! Please enter your details.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {unverified && (
          <div className="auth-message error" role="alert">
            <strong>Email not verified yet.</strong>
            <p>
              We can send a fresh link to <strong>{email}</strong>.
            </p>
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
        )}

        <div className="auth-links is-spaced-sm">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <div className="auth-divider">or</div>
        <div className="auth-links">
          Don't have an account? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;