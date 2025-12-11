// client/src/pages/VerifyEmail.jsx
// Email verification page
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No verification token provided');
      setStatus('error');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${SERVER}/api/auth/verify-email?token=${token}`);
        const data = await res.json();
        
        if (res.ok) {
          setStatus('success');
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          setError(data.error || 'Verification failed');
          setStatus('error');
        }
      } catch (err) {
        setError('Network error');
        setStatus('error');
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-title">Email Verification</h2>
        
        {status === 'verifying' && (
          <div className="text-center">
            <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
            <p className="muted" style={{ marginTop: '1rem' }}>Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div style={{ color: 'var(--success)', fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h3>Email Verified!</h3>
            <p className="muted">Your email has been verified successfully. Redirecting to login...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div style={{ color: 'var(--danger)', fontSize: '3rem', marginBottom: '1rem' }}>✗</div>
            <h3>Verification Failed</h3>
            <p className="muted">{error || 'Invalid or expired verification token.'}</p>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

