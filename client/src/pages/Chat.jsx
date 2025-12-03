// client/src/pages/Chat.jsx
import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

// Web Crypto helpers
const enc = new TextEncoder();
const dec = new TextDecoder();

async function importKeyFromBase64(b64) {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw.buffer, 'AES-GCM', true, ['encrypt','decrypt']);
}

async function encryptText(keyObj, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, enc.encode(plaintext));
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ct))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

async function decryptText(keyObj, ciphertextB64, ivB64) {
  try {
    const ct = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyObj, ct);
    return dec.decode(plain);
  } catch (e) {
    return null;
  }
}

export default function Chat({ conversationId = 'room1' }) {
  const [token] = useState(localStorage.getItem('TOKEN'));
  const [chatKeyB64] = useState(localStorage.getItem('CHAT_KEY'));
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const keyRef = useRef(null);
  const bottomRef = useRef();

  useEffect// inside useEffect: replace the fetch/connect block with this safe version
(async () => {
  try {
    keyRef.current = await importKeyFromBase64(chatKeyB64);

    const url = new URL(SERVER + '/api/messages');
    url.searchParams.set('conversationId', conversationId);
    const res = await fetch(url.toString(), {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (res.status === 401) {
      console.warn('history: 401 unauthorized — token missing/invalid');
      alert('Unauthorized: set a valid TOKEN in localStorage and refresh.');
      setMessages([]);
      return;
    }
    if (!res.ok) {
      console.error('History fetch failed', await res.text());
      setMessages([]);
      return;
    }

    const hist = await res.json();
    if (!Array.isArray(hist)) {
      console.warn('History response is not an array', hist);
      setMessages([]);
    } else {
      const decMsgs = await Promise.all(hist.map(async m => {
        if (m.ciphertext) {
          const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);
          return { ...m, text: pt ?? '<unable to decrypt>' };
        }
        return m;
      }));
      setMessages(decMsgs);
    }

    // connect socket only after history OK
    const s = io(SERVER, { auth: { token } });
    socketRef.current = s;

    s.on('connect', () => {
      s.emit('join_conversation', conversationId, () => {});
    });

    s.on('message', async (m) => {
      if (m.ciphertext && m.iv) {
        const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);
        setMessages(prev => [...prev, { ...m, text: pt ?? '<unable to decrypt>' }]);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if (m.text) {
        setMessages(prev => [...prev, m]);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    });

    s.on('connect_error', (err) => {
      console.error('socket connect_error', err);
      alert('Socket auth failed: ' + (err?.message || err));
    });
  } catch (err) {
    console.error('Chat init error', err);
    alert('Chat initialization error: ' + err.message);
  }
})();


  const send = async () => {
    if (!text.trim()) return;
    if (!socketRef.current || !socketRef.current.connected) {
    alert('Socket not connected. Check TOKEN or refresh.');
    return;
  }
    const k = keyRef.current;
    if (!k) return;
    const { ciphertext, iv } = await encryptText(k, text.trim());
    socketRef.current.emit('send_message', { roomId: conversationId, ciphertext, iv }, (ack) => {});
    setText('');
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 800, margin: '0 auto', border: '1px solid #eee', padding: 12 }}>
        <h2>Conversation: {conversationId}</h2>
        <div style={{ maxHeight: '60vh', overflow: 'auto', marginBottom: 12 }}>
          {messages.map((m) => (
            <div key={m._id ?? m.ts} style={{ padding: 8, borderRadius: 6, background: '#f3f4f6', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>{m.fromEmail ?? m.from} · {new Date(m.ts).toLocaleString()}</div>
              <div style={{ marginTop: 6 }}>{m.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input value={text} onChange={e => setText(e.target.value)} style={{ flex: 1, padding: 8 }} />
          <button onClick={send} style={{ padding: '8px 12px' }}>Send</button>
        </div>
      </div>
    </div>
  );
}
