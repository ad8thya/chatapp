// client/src/components/Header.jsx
// Header with Clerk UserButton, theme toggle
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { getTheme, setTheme, initTheme } from '../utils/ui';

export default function Header() {
  const [theme, setThemeState] = useState(() => getTheme());
  const { isSignedIn, user } = useAuth();
  
  useEffect(() => {
    initTheme();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    setTheme(newTheme);
  };

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-logo">Socket</Link>
        <nav className="header-nav">
          <Link to="/conversations">Conversations</Link>
        </nav>
      </div>

      <div className="header-right">
        {isSignedIn && user && (
          <div className="header-user" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="header-user-email">{user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress}</span>
            <UserButton 
              afterSignOutUrl="/login"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8"
                }
              }}
            />
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
      </div>
    </header>
  );
}
