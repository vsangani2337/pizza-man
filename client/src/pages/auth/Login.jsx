import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginUser } from '../../services/api';
import { toast } from 'react-toastify';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
      toast.error(err.response?.data?.message || 'Login failed' , { autoClose: 2000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* LEFT SIDE */}
      <div className="auth-decorative">
        <h2 className="auth-tagline">Wood-fired perfection,<br />delivered.</h2>
        <p className="auth-tagline-subtitle">Sign in to track your orders, re-order your favorites, and earn rewards with every slice.</p>
      </div>

      {/* RIGHT SIDE */}
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">P</div>
          <h1>Pizza Master</h1>
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

        <div className="auth-links" style={{ marginTop: '16px' }}>
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