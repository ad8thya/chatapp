// client/src/pages/Chat.jsx
import * as React from 'react';
const { useEffect, useState, useRef } = React;
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
const enc = new TextEncoder();
const dec = new TextDecoder();

// base64 helpers
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
async function importKeyFromBase64(b64) {
  if (!b64) throw new Error('missing key');
  const raw = base64ToArrayBuffer(b64);
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt','decrypt']);
  // verify length
  const exported = await crypto.subtle.exportKey('raw', key);
  if (exported.byteLength !== 32) throw new Error('invalid key length');
  return key;
}
async function encryptText(keyObj, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, enc.encode(plaintext));
  return { ciphertext: arrayBufferToBase64(ct), iv: arrayBufferToBase64(iv.buffer) };
}
async function decryptText(keyObj, ciphertextB64, ivB64) {
  try {
    const ctBuf = base64ToArrayBuffer(String(ciphertextB64 || ''));
    const ivBuf = base64ToArrayBuffer(String(ivB64 || ''));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(ivBuf) }, keyObj, ctBuf);
    return dec.decode(plain);
  } catch (e) {
    console.error('decryptText failed', e && e.message);
    return null;
  }
}

export default function Chat() {
  const { conversationId } = useParams();
  const [token] = useState(() => localStorage.getItem('TOKEN'));
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const keyRef = useRef(null);
  const bottomRef = useRef();

  useEffect(() => {
    if (!token) return;
    let mounted = true;

    (async () => {
      try {
        // fetch conversation key from server (single source of truth)
        const res = await fetch(`${SERVER}/api/conversations/${conversationId}/key`, {
          headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) {
          const txt = await res.text();
          console.error('fetch convo key failed', res.status, txt);
          return;
        }
        const { chatKey } = await res.json();
        if (!chatKey) {
          console.error('no chatKey for conversation');
          return;
        }
        keyRef.current = await importKeyFromBase64(chatKey);
        // fetch history
        const url = new URL(SERVER + '/api/messages');
        url.searchParams.set('conversationId', conversationId);
        const histRes = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + token } });
        if (!histRes.ok) {
          console.warn('history fetch failed', histRes.status, await histRes.text());
          return;
        }
        const hist = await histRes.json();
        const decMsgs = await Promise.all(hist.map(async m => {
          if (m.ciphertext && m.iv) {
            const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);
            return { ...m, text: pt ?? '<unable to decrypt>' };
          }
          return m;
        }));
        if (mounted) setMessages(decMsgs);

        // connect socket once
        if (!socketRef.current) {
          const s = io(SERVER, {
            auth: { token },
            transports: ['websocket'],       // force websocket
            reconnection: true,
            reconnectionAttempts: Infinity,
            timeout: 10000
          });

          socketRef.current = s;
          window.__chat_socket = s; // debug access

          s.on('connect', () => {
            console.info('socket connected:', s.id);
            s.emit('join_conversation', conversationId, (ack) => {
              console.info('join ack:', ack);
            });
          });

          s.on('connect_error', (err) => {
            console.error('socket connect_error:', err?.message || err);
            if (err?.data) console.error('connect_error data:', err.data);
          });

          s.on('reconnect_attempt', (attempt) => {
            console.warn('socket reconnect_attempt:', attempt);
          });

          s.on('disconnect', (reason) => {
            console.warn('socket disconnected:', reason);
          });

          // Keep your existing message handler exactly as-is below this comment
          // (do NOT change any of your message decryption or rendering logic)
          s.on('message', async (m) => {
            // keep last message for debugging
            window.__debug_last_msg = m;
            if (m.ciphertext && m.iv) {
              const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);
              setMessages(prev => [...prev, { ...m, text: pt ?? '<unable to decrypt>' }]);
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            } else if (m.text) {
              setMessages(prev => [...prev, m]);
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
          });
        }
      } catch (err) {
        console.error('chat init error', err);
      }
    })();

    return () => {
      mounted = false;
      try { socketRef.current?.disconnect(); } catch (e) {}
      socketRef.current = null;
    };
  }, [token, conversationId]);

  const send = async () => {
    if (!text.trim()) return;
    if (!socketRef.current || !socketRef.current.connected) {
      alert('Socket not connected');
      return;
    }
    if (!keyRef.current) {
      alert('Encryption key not ready');
      return;
    }
    const { ciphertext, iv } = await encryptText(keyRef.current, text.trim());
    // send strings only
    socketRef.current.emit('send_message', { roomId: conversationId, ciphertext: String(ciphertext), iv: String(iv) }, (ack) => {});
    setText('');
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <h2>Conversation: {conversationId}</h2>
          <div>
            <button onClick={() => { localStorage.removeItem('TOKEN'); window.location.href = '/login'; }}>Logout</button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map(m => (
            <div key={m._id ?? m.ts}>
              <div style={{fontSize:12,color:'#666'}}>{m.fromEmail ?? m.from} · {new Date(m.ts).toLocaleString()}</div>
              <div style={{marginTop:6}}>{m.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-container">
          <input value={text} onChange={e => setText(e.target.value)} />
          <button onClick={send} disabled={!text.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}
