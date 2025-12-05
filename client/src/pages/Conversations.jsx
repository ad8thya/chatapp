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
    <div style={{ padding:20 }}>
      <h2>Your Conversations</h2>

      {loading && <div>Loading conversations…</div>}

      {error && (
        <div style={{ color: 'crimson', marginBottom: 12 }}>
          <strong>Error:</strong>{' '}
          {(error?.body && typeof error.body === 'string') ? error.body :
           (error?.body && typeof error.body === 'object' ? JSON.stringify(error.body) : error?.message || String(error))}
        </div>
      )}

      {!loading && Array.isArray(list) && list.length === 0 && <div>No conversations yet</div>}

      {!loading && Array.isArray(list) && list.map(c => (
        <div key={c._id} style={{ marginBottom: 8 }}>
          <Link to={`/chat/${c._id}`}>{c.title || c._id}</Link>
        </div>
      ))}

      <hr style={{ margin: '12px 0' }} />

      <h3>Create Conversation</h3>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <input placeholder="Participant emails (comma separated)" value={emails} onChange={e => setEmails(e.target.value)} />
        <button onClick={createConversation}>Create</button>
      </div>
    </div>
  );
}
