import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { resetPassword } from '../../services/api';
import { validatePassword } from '../../utils/validation';
import { toast } from 'react-toastify';
import './Auth.css';

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Get latest values directly from the form inputs (avoid stale state)
    const newPassword = e.target['new-password'].value.trim();
    const confirmPwd = e.target['confirm-new-password'].value.trim();

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return toast.error(passwordError);
    }

    // Then validate match
    if (newPassword !== confirmPwd) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      const { data } = await resetPassword(token, { password: newPassword });
      toast.success(data.message);
      setSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page single-column">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">{success ? '✓' : '🔒'}</div>
          <h1>{success ? 'Password Reset!' : 'Reset Password'}</h1>
          {!success && <p>Enter your new password below</p>}
        </div>

        {success ? (
          <div className="auth-success-state">
            <div className="auth-message success">Your password has been reset successfully.</div>
            <div className="auth-links"><Link to="/login">Go to Login</Link></div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                placeholder="Min. 8 characters with a letter & number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-new-password">Confirm Password</label>
              <input
                id="confirm-new-password"
                type="password"
                className="form-input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {/* Live match indicator — shows while typing */}
            {confirmPassword.length > 0 && (
              <p className={`auth-match ${password === confirmPassword ? 'is-ok' : 'is-bad'}`}>
                {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;