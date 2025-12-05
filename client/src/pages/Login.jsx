// client/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiLogin } from '../utils/auth';

function generateChatKeyBase64() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  let str = '';
  for (let i = 0; i < raw.length; ++i) str += String.fromCharCode(raw[i]);
  return btoa(str);
}

export default function Login(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setErr('');
    setBusy(true);
    try {
      const res = await apiLogin(email.trim(), password);
      console.log('login response ->', res);
      // defensive: handle different shapes
      const token = res?.token || (res?.data && res.data.token) || (res?.accessToken);
      if (!token) {
        throw new Error('login response missing token');
      }
      // store token
      localStorage.setItem('TOKEN', token);
      // after localStorage.setItem('TOKEN', token);
      if (res.user) {
        try { localStorage.setItem('USER', JSON.stringify(res.user)); } catch(e) {}
      }


      // ensure a CHAT_KEY exists for demo: reuse existing or generate
      if (!localStorage.getItem('CHAT_KEY')) {
        const k = generateChatKeyBase64();
        localStorage.setItem('CHAT_KEY', k);
      }

      // use SPA navigation to conversations (no full reload)
      nav('/conversations', { replace: true });
    } catch (err) {
      console.error('login error', err);
      setErr(err?.error || err?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-title">Login</h2>
        <form onSubmit={onSubmit} className="auth-form">
          <div className="auth-form-group">
            <label htmlFor="login-email" className="label">Email</label>
            <input 
              id="login-email"
              className="auth-form-input"
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              type="email" 
              required 
              autoComplete="email"
            />
          </div>
          <div className="auth-form-group">
            <label htmlFor="login-password" className="label">Password</label>
            <input 
              id="login-password"
              className="auth-form-input"
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              type="password" 
              required 
              autoComplete="current-password"
            />
          </div>
          <div className="auth-form-actions">
            <button disabled={busy} className="btn btn-primary auth-form-button">Login</button>
            <Link to="/register" className="auth-form-link">Register</Link>
          </div>
          {err && <div className="auth-error">{err}</div>}
        </form>
      </div>
    </div>
  );
}
