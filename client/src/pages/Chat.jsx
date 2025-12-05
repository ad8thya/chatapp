// client/src/pages/Chat.jsx
import * as React from 'react';
const { useEffect, useState, useRef } = React;
import { io } from 'socket.io-client';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

// Web Crypto helpers
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- robust binary <-> base64 helpers ----------
function arrayBufferToBase64(buffer) {
  // chunk safe conversion
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ---------- key import ----------
async function importKeyFromBase64(b64) {
  const rawBuf = base64ToArrayBuffer(b64);
  return crypto.subtle.importKey('raw', rawBuf, 'AES-GCM', true, ['encrypt','decrypt']);
}

// ---------- encrypt ----------
async function encryptText(keyObj, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ptBuf = enc.encode(plaintext);
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, ptBuf);

  const ciphertext = arrayBufferToBase64(ctBuf);
  const ivB64 = arrayBufferToBase64(iv.buffer);

  // debug: lengths
  // console.debug('encrypt -> ciphertext len', ciphertext.length, 'iv len', ivB64.length);

  return { ciphertext, iv: ivB64 };
}

// ---------- decrypt ----------
async function decryptText(keyObj, ciphertextB64, ivB64) {
  try {
    const ctBuf = base64ToArrayBuffer(ciphertextB64);
    const ivBuf = base64ToArrayBuffer(ivB64);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(ivBuf) }, keyObj, ctBuf);
    return dec.decode(plainBuf);
  } catch (e) {
    // keep real error hidden from users but log for debugging
    console.error('decryptText failed', e && e.message);
    return null;
  }
}


import { useParams } from 'react-router-dom';

export default function Chat() {
  const { conversationId } = useParams();
  // read token/key from localStorage at mount (defensive)
  const [token] = useState(() => {
    try { return localStorage.getItem('TOKEN'); } catch (e) { console.error('localStorage access failed', e); return null; }
  });
  const [chatKeyB64] = useState(() => {
    try { return localStorage.getItem('CHAT_KEY'); } catch (e) { console.error('localStorage access failed', e); return null; }
  });

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const keyRef = useRef(null);
  const bottomRef = useRef();

  useEffect(() => {
    // defensive: require token and chat key
    if (!token) {
      console.warn('No TOKEN in localStorage; aborting chat init.');
      return;
    }
    if (!chatKeyB64) {
      console.warn('No CHAT_KEY in localStorage; aborting chat init.');
      return;
    }

    let mounted = true;
    let s = null;

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
          console.warn('history: 401 unauthorized — token missing/invalid');
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
          console.warn('History response is not an array', hist);
          if (mounted) setMessages([]);
        } else {
          const decMsgs = await Promise.all(hist.map(async m => {
            if (m.ciphertext && m.iv) {
              const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);
              return { ...m, text: pt ?? '<unable to decrypt>' };
            }
            return m;
          }));
          if (mounted) setMessages(decMsgs);
        }

        // connect socket after history + key ok
        s = io(SERVER, { auth: { token } });
        socketRef.current = s;

        s.on('connect', () => {
          s.emit('join_conversation', conversationId, () => {});
        });

        s.on('message', async (m) => {
          if (!mounted) return;
            console.debug('DEBUG incoming message raw ->', {
            from: m.fromEmail || m.from,
            ciphertext_sample: (m.ciphertext || '').slice(0,24),
            iv_sample: (m.iv || '').slice(0,24),
            hasCipher: !!m.ciphertext,
            hasIv: !!m.iv,
            ts: m.ts
          });
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
          // do not alert repeatedly; log only
        });

      } catch (err) {
        console.error('Chat init error', err);
        if (mounted) setMessages([]);
      }
    })();

    return () => {
      mounted = false;
      try { socketRef.current?.disconnect(); } catch (e) {}
      socketRef.current = null;
    };
  }, [token, chatKeyB64, conversationId]);

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
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
  <h2 style={{margin:0}}>Conversation: {conversationId}</h2>
  <div style={{display:'flex', gap:8}}>
    <button onClick={() => {
      localStorage.removeItem('TOKEN');
      // keep CHAT_KEY if you want, or remove for safety:
      // localStorage.removeItem('CHAT_KEY');
      window.location.href = '/login';
    }}>Logout</button>
  </div>
</div>

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
