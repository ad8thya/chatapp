// client/src/components/Header.jsx
import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Simple header that reads TOKEN from localStorage, decodes small info (email),
 * and exposes a Logout button. Lightweight, no extra deps.
 */

function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    return null;
  }
}

export default function Header() {
  const nav = useNavigate();
  const token = (() => {
    try { return localStorage.getItem('TOKEN'); } catch (e) { return null; }
  })();

  const user = useMemo(() => {
    if (!token) return null;
    return decodeJwt(token);
  }, [token]);

  const email = user?.email || user?.sub || null;

  const onLogout = () => {
    // remove all sensitive client-side state
    try {
      localStorage.removeItem('TOKEN');
      localStorage.removeItem('CHAT_KEY');
      localStorage.removeItem('USER'); // if you choose to store user object
    } catch (e) {}
    // navigate to login page (SPA style)
    nav('/login', { replace: true });
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      borderBottom: '1px solid #eee',
      background: '#fff',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#111', fontWeight: 700 }}>ChatApp</Link>
        <nav style={{ display: 'flex', gap: 10 }}>
          <Link to="/conversations" style={{ textDecoration: 'none', color: '#555' }}>Conversations</Link>
          {/* keep /chat route but /chat without id redirects, so avoid linking plain /chat */}
        </nav>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {email ? (
          <div style={{ fontSize: 13, color: '#333' }}>
            <div style={{ fontWeight: 600 }}>{email}</div>
          </div>
        ) : null}

        <button
          onClick={onLogout}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #ddd',
            background: '#fff',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
