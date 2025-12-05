// client/src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiRegister } from '../utils/auth';

function generateChatKeyBase64() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  let str = '';
  for (let i = 0; i < raw.length; ++i) str += String.fromCharCode(raw[i]);
  return btoa(str);
}

export default function Register(){
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setErr('');
    setBusy(true);
    try {
      const res = await apiRegister(email.trim(), password, displayName.trim());
      console.log('register response ->', res);
      const token = res?.token || (res?.data && res.data.token) || (res?.accessToken);
      if (!token) throw new Error('registration response missing token');

      localStorage.setItem('TOKEN', token);
      if (res.user) {
        try { localStorage.setItem('USER', JSON.stringify(res.user)); } catch(e) {}
      }
      // create a fresh CHAT_KEY for the user (demo)
      const k = generateChatKeyBase64();
      localStorage.setItem('CHAT_KEY', k);

      // use SPA navigation to conversations
      nav('/conversations', { replace: true });
    } catch (err) {
      console.error('register error', err);
      setErr(err?.error || err?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-title">Register</h2>
        <form onSubmit={onSubmit} className="auth-form">
          <div className="auth-form-group">
            <label htmlFor="register-display-name" className="label">Display name</label>
            <input 
              id="register-display-name"
              className="auth-form-input"
              value={displayName} 
              onChange={e=>setDisplayName(e.target.value)} 
              required 
              autoComplete="name"
            />
          </div>
          <div className="auth-form-group">
            <label htmlFor="register-email" className="label">Email</label>
            <input 
              id="register-email"
              className="auth-form-input"
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              type="email" 
              required 
              autoComplete="email"
            />
          </div>
          <div className="auth-form-group">
            <label htmlFor="register-password" className="label">Password</label>
            <input 
              id="register-password"
              className="auth-form-input"
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              type="password" 
              required 
              autoComplete="new-password"
            />
          </div>
          <div className="auth-form-actions">
            <button disabled={busy} className="btn btn-primary auth-form-button">Create account</button>
            <Link to="/login" className="auth-form-link">Back to login</Link>
          </div>
          {err && <div className="auth-error">{err}</div>}
        </form>
      </div>
    </div>
  );
}
