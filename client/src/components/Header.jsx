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
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-logo">ChatApp</Link>
        <nav className="header-nav">
          <Link to="/conversations">Conversations</Link>
          {/* keep /chat route but /chat without id redirects, so avoid linking plain /chat */}
        </nav>
      </div>

      <div className="header-right">
        {email ? (
          <div className="header-user">
            <div className="header-user-email">{email}</div>
          </div>
        ) : null}

        <button
          onClick={onLogout}
          className="btn btn-ghost header-logout"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
