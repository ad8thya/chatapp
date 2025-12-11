// client/src/pages/Conversations.jsx
// UI-only updates — no backend/API changes
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { formatTime } from '../utils/ui';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

/**
 * Defensive Conversations page:
 * - Checks for TOKEN before calling API
 * - Handles non-JSON and non-array responses gracefully
 * - Shows simple error and loading states so the UI doesn't crash
 */

export default function Conversations(){
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const nav = useNavigate();

  const token = (() => {
    try { return localStorage.getItem('TOKEN'); }
    catch (e) { console.error('localStorage access failed', e); return null; }
  })();

  useEffect(() => {
    // If no token, bail early (prevents wrong calls from unauth'd pages)
    if (!token) {
      setError({ error: 'no_token', message: 'Not authenticated. Please login.' });
      setLoading(false);
      setList([]);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
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
          setError(err);
          setList([]);
          setLoading(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, [token]);

  const createConversation = async () => {
    if (!token) {
      setError({ error: 'no_token', message: 'Login required' });
      return;
    }
    setError(null);
    try {
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
      setError(err);
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
          <div className="error-box" style={{ margin: '1rem' }}>
            <strong>Error:</strong>{' '}
            {(error?.body && typeof error.body === 'string') ? error.body :
             (error?.body && typeof error.body === 'object' ? JSON.stringify(error.body) : error?.message || String(error))}
          </div>
        )}

        {!loading && Array.isArray(list) && list.length === 0 && (
          <div className="conversations-empty">No conversations yet</div>
        )}

        {!loading && Array.isArray(filteredList) && filteredList.length > 0 && (
          <div className="conversations-list">
            {filteredList.map(c => (
              <Link key={c._id} to={`/chat/${c._id}`} className="conversation-item">
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
