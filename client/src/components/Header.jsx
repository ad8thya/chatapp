// client/src/components/Header.jsx
// UI-only component — no backend changes
// Header with user avatar, theme toggle, and logout

import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { getTheme, setTheme, initTheme } from '../utils/ui';

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
  const [theme, setThemeState] = useState(() => getTheme());
  
  useEffect(() => {
    initTheme();
  }, []);

  const token = (() => {
    try { return localStorage.getItem('TOKEN'); } catch (e) { return null; }
  })();

  const user = useMemo(() => {
    if (!token) return null;
    try {
      const stored = localStorage.getItem('USER');
      if (stored) return JSON.parse(stored);
    } catch {}
    return decodeJwt(token);
  }, [token]);

  const email = user?.email || user?.sub || null;

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    setTheme(newTheme);
  };

  const onLogout = () => {
    try {
      localStorage.removeItem('TOKEN');
      localStorage.removeItem('CHAT_KEY');
      localStorage.removeItem('USER');
    } catch (e) {}
    nav('/login', { replace: true });
  };

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-logo">ChatApp</Link>
        <nav className="header-nav">
          <Link to="/conversations">Conversations</Link>
        </nav>
      </div>

      <div className="header-right">
        {email && (
          <div className="header-user">
            <Avatar email={email} name={user?.displayName || user?.name} size={32} />
            <span className="header-user-email">{email}</span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="btn btn-ghost header-theme-toggle"
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2v2M10 16v2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M2 10h2M16 10h2M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41M10 14a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {token && (
          <button
            onClick={onLogout}
            className="btn btn-ghost header-logout"
            aria-label="Logout"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
