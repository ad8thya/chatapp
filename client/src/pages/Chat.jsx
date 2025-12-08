// client/src/pages/Chat.jsx
import * as React from 'react';
const { useEffect, useState, useRef } = React;
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

// Text encoder/decoder
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- binary/base64 helpers ----------
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64) {
  // defensive: if empty or not a string return empty buffer
  if (!b64 || typeof b64 !== 'string') return new ArrayBuffer(0);
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ---------- key handling ----------
function generateChatKeyBase64AndSave() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const k = arrayBufferToBase64(raw.buffer);
  try { localStorage.setItem('CHAT_KEY', k); } catch (e) { /* ignore */ }
  return k;
}

async function importKeyFromBase64(b64) {
  try {
    if (!b64 || typeof b64 !== 'string') {
      const k = generateChatKeyBase64AndSave();
      return crypto.subtle.importKey('raw', base64ToArrayBuffer(k), 'AES-GCM', true, ['encrypt','decrypt']);
    }
    const trimmed = b64.trim();
    // base64 of 32 bytes should be 44 chars (with padding); but be flexible
    if (trimmed.length < 40) {
      console.warn('CHAT_KEY looks invalid, regenerating.');
      const k = generateChatKeyBase64AndSave();
      return crypto.subtle.importKey('raw', base64ToArrayBuffer(k), 'AES-GCM', true, ['encrypt','decrypt']);
    }
    return crypto.subtle.importKey('raw', base64ToArrayBuffer(trimmed), 'AES-GCM', true, ['encrypt','decrypt']);
  } catch (e) {
    console.warn('importKeyFromBase64 failed, generating new key', e && e.message);
    const k = generateChatKeyBase64AndSave();
    return crypto.subtle.importKey('raw', base64ToArrayBuffer(k), 'AES-GCM', true, ['encrypt','decrypt']);
  }
}

// ---------- encrypt / decrypt ----------
async function encryptText(keyObj, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ptBuf = enc.encode(plaintext);
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, ptBuf);

  return {
    ciphertext: arrayBufferToBase64(ctBuf),
    iv: arrayBufferToBase64(iv.buffer)
  };
}

async function decryptText(keyObj, ciphertextB64, ivB64) {
  try {
    const ctBuf = base64ToArrayBuffer(String(ciphertextB64 || ''));
    const ivBuf = base64ToArrayBuffer(String(ivB64 || ''));
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(ivBuf) }, keyObj, ctBuf);
    return dec.decode(plainBuf);
  } catch (e) {
    // log for debugging; return null to indicate failure
    console.error('decryptText failed', e && e.message);
    return null;
  }
}

// decode token to show which messages are mine
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch (e) {
    return null;
  }
}

export default function Chat() {
  const { conversationId } = useParams();
  const [token] = useState(() => {
    try { return localStorage.getItem('TOKEN'); } catch (e) { console.error('localStorage access failed', e); return null; }
  });
  const [chatKeyB64] = useState(() => {
    try { return localStorage.getItem('CHAT_KEY'); } catch (e) { console.error('localStorage access failed', e); return null; }
  });

  const currentUserEmail = token ? (decodeJwt(token)?.email || decodeJwt(token)?.sub) : null;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const keyRef = useRef(null);
  const bottomRef = useRef();
  // set to track message ids and avoid duplicates
  const msgIdSetRef = useRef(new Set());

  useEffect(() => {
    if (!token) {
      console.warn('No TOKEN — aborting chat init.');
      return;
    }
    if (!conversationId) {
      console.warn('No conversationId — aborting chat init.');
      return;
    }

    let mounted = true;

    (async () => {
      try {
        keyRef.current = await importKeyFromBase64(chatKeyB64);

        // fetch history
        const url = new URL(SERVER + '/api/messages');
        url.searchParams.set('conversationId', conversationId);
        const res = await fetch(url.toString(), {
          headers: { Authorization: 'Bearer ' + token }
        });

        if (res.status === 401) {
          console.warn('history: 401 unauthenticated.');
          if (mounted) setMessages([]);
          return;
        }
        if (!res.ok) {
          console.error('History fetch failed', await res.text());
          if (mounted) setMessages([]);
          return;
        }

        const hist = await res.json();
        if (!Array.isArray(hist)) {
          console.warn('History response unexpected', hist);
          if (mounted) setMessages([]);
        } else {
          // decode & dedupe
          const decMsgs = [];
          for (const m of hist) {
            // avoid duplicates if server returned duplicates
            if (m._id && msgIdSetRef.current.has(String(m._id))) continue;
            if (m.ciphertext && m.iv && keyRef.current) {
              const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);
              decMsgs.push({ ...m, text: pt ?? '<unable to decrypt>' });
            } else {
              decMsgs.push(m);
            }
            if (m._id) msgIdSetRef.current.add(String(m._id));
          }
          if (mounted) setMessages(decMsgs);
        }

        // socket connect (single socket per tab)
        if (!socketRef.current) {
          const s = io(SERVER, {
            auth: { token },
            transports: ['websocket'],
            reconnection: true
          });
          socketRef.current = s;
          try { window.__chat_socket = s; } catch (e) {}

          s.on('connect', () => {
            console.info('socket connected ->', s.id);
            s.emit('join_conversation', conversationId, () => {});
          });

          s.on('message', async (m) => {
            try {
              // expose last raw message for debugging
              try { window.__debug_last_msg = m; } catch (e) {}
              // quick logs for debugging mismatches
              console.debug('INCOMING message', { id: m._id, ciphertext_len: (m.ciphertext||'').length, iv_len: (m.iv||'').length });

              if (m._id && msgIdSetRef.current.has(String(m._id))) {
                // duplicate — ignore
                console.debug('duplicate message ignored', m._id);
                return;
              }

              let appended = null;
              if (m.ciphertext && m.iv && keyRef.current) {
                const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);
                appended = { ...m, text: pt ?? '<unable to decrypt>' };
              } else if (m.text) {
                appended = m;
              } else {
                appended = m;
              }

              if (m._id) msgIdSetRef.current.add(String(m._id));
              setMessages(prev => [...prev, appended]);
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            } catch (err) {
              console.error('Error handling incoming message', err);
            }
          });

          s.on('connect_error', (err) => {
            console.error('socket connect_error', err && (err.message || err));
          });
          s.on('disconnect', (reason) => {
            console.warn('socket disconnected', reason);
          });
        }

      } catch (err) {
        console.error('Chat init error', err);
        if (mounted) setMessages([]);
      }
    })();

    return () => {
      mounted = false;
      try { socketRef.current?.disconnect(); } catch (e) {}
      socketRef.current = null;
      msgIdSetRef.current.clear();
    };
  }, [token, chatKeyB64, conversationId]);

  const send = async () => {
    if (!text.trim()) return;
    if (!socketRef.current || !socketRef.current.connected) {
      alert('Socket not connected. Check TOKEN or refresh.');
      return;
    }
    const k = keyRef.current;
    if (!k) {
      alert('Missing CHAT_KEY; cannot encrypt');
      return;
    }

    try {
      const { ciphertext, iv } = await encryptText(k, text.trim());
      // don't append locally; server will emit back and client will append (dedupe ensures single show)
      socketRef.current.emit('send_message', { roomId: conversationId, ciphertext, iv }, (ack) => {});
      setText('');
    } catch (err) {
      console.error('send error', err);
      alert('Failed to send message: ' + String(err));
    }
  };

  const isMyMessage = (message) => {
    const msgEmail = message.fromEmail || message.from;
    return currentUserEmail && msgEmail && msgEmail.toLowerCase() === currentUserEmail.toLowerCase();
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 800, margin: '0 auto', border: '1px solid #eee', padding: 12 }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <h2 style={{margin:0}}>Conversation: {conversationId}</h2>
          <div>
            <button onClick={() => {
              try { localStorage.removeItem('TOKEN'); } catch(e){}
              window.location.href = '/login';
            }}>Logout</button>
          </div>
        </div>

        <div style={{ maxHeight: '60vh', overflow: 'auto', marginBottom: 12 }}>
          {messages.map((m) => (
            <div key={m._id ?? m.ts} style={{ padding: 8, borderRadius: 6, background: isMyMessage(m) ? '#e6ffed' : '#f3f4f6', marginBottom: 8 }}>
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
