// client/src/pages/Conversations.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import Avatar from '../components/Avatar';
import { formatTime } from '../utils/ui';
import { getAuthToken } from '../utils/auth';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

/**
 * Conversations page:
 * - Uses Clerk authentication
 * - Handles non-JSON and non-array responses gracefully
 * - Shows simple error and loading states so the UI doesn't crash
 */

export default function Conversations(){
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const nav = useNavigate();

  // Wait for Clerk to load
  if (!isLoaded) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isSignedIn) {
    return null; // ProtectedRoute will handle redirect
  }

  useEffect(() => {
    if (!isSignedIn || !isLoaded || !getToken) {
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Get token for API call
        const token = await getAuthToken(getToken);
        
        const res = await fetch(`${SERVER}/api/conversations`, {
          headers: { Authorization: 'Bearer ' + token }
        });

        const text = await res.text();
        // try to parse JSON if possible
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }

        if (!res.ok) {
          // show backend error (either parsed JSON or raw text)
          throw { status: res.status, body };
        }

        if (!Array.isArray(body)) {
          // backend returned something unexpected
          throw { status: res.status, body: body ?? '<empty>' };
        }

        if (mounted) {
          setList(body);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load conversations', err);
        if (mounted) {
          // Extract error message from various error formats
          let errorMessage = 'Failed to load conversations';
          let errorType = 'unknown_error';
          
          if (err instanceof Error) {
            errorMessage = err.message;
            if (err.message?.includes('template') || err.message?.includes('JWT template')) {
              errorType = 'jwt_template_missing';
            } else if (err.message?.includes('token') || err.message?.includes('authentication')) {
              errorType = 'token_fetch_failed';
            }
          } else if (typeof err === 'string') {
            errorMessage = err;
          } else if (err?.message) {
            errorMessage = err.message;
          } else if (err?.body) {
            if (typeof err.body === 'string') {
              errorMessage = err.body;
            } else if (err.body?.error) {
              errorMessage = err.body.error;
            } else if (err.body?.message) {
              errorMessage = err.body.message;
            } else {
              errorMessage = JSON.stringify(err.body);
            }
          } else if (err?.error) {
            errorMessage = String(err.error);
          }
          
          setError({ 
            error: errorType,
            message: errorMessage || 'An unknown error occurred'
          });
          setList([]);
          setLoading(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, [isSignedIn, isLoaded, getToken]);

  const createConversation = async () => {
    if (!isSignedIn || !getToken) {
      setError({ error: 'no_token', message: 'Login required' });
      return;
    }
    setError(null);
    try {
      // Get token for API call
      const token = await getAuthToken(getToken);
      
      const participantEmails = emails.split(',').map(e => e.trim()).filter(Boolean);
      const res = await fetch(`${SERVER}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ title, participantEmails })
      });

      const text = await res.text();
      let body;
      try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }

      if (!res.ok) throw body || { error: 'create_failed', status: res.status };

      // if creation OK, navigate to chat
      nav(`/chat/${body._id}`);
    } catch (err) {
      console.error('create convo err', err);
      let errorMessage = 'Failed to create conversation.';
      let errorType = 'create_failed';
      
      if (err instanceof Error) {
        errorMessage = err.message;
        if (err.message?.includes('template') || err.message?.includes('JWT template')) {
          errorType = 'jwt_template_missing';
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.body) {
        if (typeof err.body === 'string') {
          errorMessage = err.body;
        } else if (err.body?.error) {
          errorMessage = err.body.error;
        } else if (err.body?.message) {
          errorMessage = err.body.message;
        }
      } else if (err?.error) {
        errorMessage = String(err.error);
      }
      
      setError({ 
        error: errorType,
        message: errorMessage
      });
    }
  };

  const deleteConversation = async (id, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!confirm('Delete this conversation? This cannot be undone.')) {
      return;
    }

    if (!isSignedIn || !getToken) {
      setError({ error: 'no_token', message: 'Login required' });
      return;
    }

    try {
      // Get token for API call
      const token = await getAuthToken(getToken);
      
      const res = await fetch(`${SERVER}/api/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });

      if (!res.ok) {
        const text = await res.text();
        let body;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
        throw body || { error: 'delete_failed' };
      }

      // Remove from list
      setList(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      console.error('delete conversation err', err);
      alert('Failed to delete conversation');
    }
  };

  const filteredList = list.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (c.title || '').toLowerCase().includes(query) || 
           (c._id || '').toLowerCase().includes(query);
  });

  return (
    <div className="conversations-page">
      <div className="conversations-sidebar">
        <div className="conversations-title">
          <h2>Conversations</h2>
        </div>
        <div className="conversations-search">
          <input
            type="search"
            className="conversations-search-input"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search conversations"
          />
        </div>

        {loading && (
          <div className="conversations-loading">
            <div className="loading-spinner"></div>
            <p style={{ marginTop: '1rem' }}>Loading conversations…</p>
          </div>
        )}

        {error && (
          <div className="error-box" style={{ margin: '1rem', padding: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
            <strong>Error:</strong>{' '}
            <span style={{ wordBreak: 'break-word' }}>
              {error?.message || 
               (typeof error === 'string' ? error : 
                (error?.body && typeof error.body === 'string') ? error.body :
                (error?.body && typeof error.body === 'object' ? JSON.stringify(error.body) : 
                 (error?.error ? String(error.error) : 'An unknown error occurred')))}
            </span>
            {(error?.error === 'jwt_template_missing' || error?.message?.includes('template') || error?.message?.includes('JWT template')) && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.9em', color: '#666' }}>
                <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>To fix this:</p>
                <ol style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                  <li>Go to your <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>Clerk Dashboard</a></li>
                  <li>Navigate to <strong>Configure</strong> → <strong>JWT Templates</strong></li>
                  <li>Click <strong>+ New template</strong></li>
                  <li>Name it exactly: <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '2px' }}>default</code> (case-sensitive)</li>
                  <li>Save the template</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            )}
            {(error?.error === 'token_fetch_failed' || error?.message?.includes('token') || error?.message?.includes('authentication')) && !error?.message?.includes('template') && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.9em', color: '#666' }}>
                <p style={{ marginTop: '0.5rem' }}>Possible causes:</p>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                  <li>JWT template "default" doesn't exist in Clerk dashboard</li>
                  <li>User is not signed in</li>
                  <li>Network connection issue</li>
                </ul>
                <p style={{ marginTop: '0.5rem' }}>Check the browser console (F12) for more details.</p>
              </div>
            )}
          </div>
        )}

        {!loading && Array.isArray(list) && list.length === 0 && (
          <div className="conversations-empty">No conversations yet</div>
        )}

        {!loading && Array.isArray(filteredList) && filteredList.length > 0 && (
          <div className="conversations-list">
            {filteredList.map(c => (
              <div key={c._id} className="conversation-item-wrapper">
                <Link to={`/chat/${c._id}`} className="conversation-item">
                  <Avatar email={c.title || c._id} size={40} className="conversation-item__avatar" />
                  <div className="conversation-item__content">
                    <div className="conversation-item__title">{c.title || `Conversation ${c._id.slice(-6)}`}</div>
                    <div className="conversation-item__preview">Tap to open</div>
                  </div>
                  <div className="conversation-item__meta">
                    {c.updatedAt && (
                      <div className="conversation-item__time">{formatTime(c.updatedAt)}</div>
                    )}
                  </div>
                </Link>
                <button
                  onClick={(e) => deleteConversation(c._id, e)}
                  className="conversation-item__delete"
                  aria-label="Delete conversation"
                  title="Delete conversation"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && searchQuery && filteredList.length === 0 && (
          <div className="conversations-empty">No conversations match "{searchQuery}"</div>
        )}
      </div>

      <div className="conversations-create">
        <h3 className="conversations-create-title">Create Conversation</h3>

        <div className="conversations-form">
          <div className="conversations-form-row">
            <label htmlFor="conversation-title" className="label" style={{ display: 'none' }}>Title</label>
            <input
              id="conversation-title"
              className="conversations-form-input"
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              aria-label="Conversation title"
            />
            <label htmlFor="conversation-emails" className="label" style={{ display: 'none' }}>Participant emails</label>
            <input
              id="conversation-emails"
              className="conversations-form-input"
              placeholder="Participant emails (comma separated)"
              value={emails}
              onChange={e => setEmails(e.target.value)}
              aria-label="Participant emails (comma separated)"
            />
            <button onClick={createConversation} className="btn btn-primary conversations-form-button">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
