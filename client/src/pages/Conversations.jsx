// client/src/pages/Conversations.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Defensive Conversations page:
 * - Checks for TOKEN before calling API
 * - Handles non-JSON and non-array responses gracefully
 * - Shows simple error and loading states so the UI doesn't crash
 */

export default function Conversations(){
  const [list, setList] = useState([]);        // will hold array of convos
  const [title, setTitle] = useState('');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
        const res = await fetch('http://localhost:3000/api/conversations', {
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
      const res = await fetch('http://localhost:3000/api/conversations', {
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

  return (
    <div className="conversations-page">
      <h2 className="conversations-title">Your Conversations</h2>

      {loading && <div className="conversations-loading">Loading conversations…</div>}

      {error && (
        <div className="error-box">
          <strong>Error:</strong>{' '}
          {(error?.body && typeof error.body === 'string') ? error.body :
           (error?.body && typeof error.body === 'object' ? JSON.stringify(error.body) : error?.message || String(error))}
        </div>
      )}

      {!loading && Array.isArray(list) && list.length === 0 && (
        <div className="conversations-empty">No conversations yet</div>
      )}

      {!loading && Array.isArray(list) && list.length > 0 && (
        <div className="conversations-list">
          {list.map(c => (
            <Link key={c._id} to={`/chat/${c._id}`} className="conversation-item">
              {c.title || c._id}
            </Link>
          ))}
        </div>
      )}

      <hr className="conversations-divider" />

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
