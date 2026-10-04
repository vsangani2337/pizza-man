import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyEmail } from '../../services/api';
import './Auth.css';

const VerifyEmail = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [expired, setExpired] = useState(false);
  // React StrictMode mounts effects twice in development; only fire once per token.
  const hasRequested = useRef(false);

  useEffect(() => {
    if (hasRequested.current) return;
    hasRequested.current = true;

    (async () => {
      try {
        const { data } = await verifyEmail(token);
        setMessage(data.message);
        setStatus('success');
      } catch (err) {
        setMessage(err.response?.data?.message || 'Verification failed');
        setExpired(Boolean(err.response?.data?.expired));
        setStatus('error');
      }
    })();
  }, [token]);

  return (
    <div className="auth-page single-column">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            {status === 'loading' ? '⏳' : status === 'success' ? '✅' : '❌'}
          </div>
          <h1>
            {status === 'loading'
              ? 'Verifying...'
              : status === 'success'
                ? 'Email Verified!'
                : 'Verification Failed'}
          </h1>
        </div>
        {status !== 'loading' && (
          <>
            <div className={`auth-message ${status === 'success' ? 'success' : 'error'}`}>
              {message}
            </div>
            {expired && (
              <p className="auth-hint">
                Sign in with your email and we&apos;ll offer to send you a fresh link.
              </p>
            )}
            <div className="auth-links">
              <Link to="/login">Go to Login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
