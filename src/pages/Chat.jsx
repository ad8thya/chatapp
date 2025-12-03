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

// Chat component
export default function Chat({ conversationId = 'room1' }) {
  const [token] = useState(localStorage.getItem('TOKEN'));
  const [chatKeyB64] = useState(localStorage.getItem('CHAT_KEY'));
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const keyRef = useRef(null);
  const bottomRef = useRef();

  useEffect(() => {
    if (!token) {
      alert('No token found. Login first.');
      return;
    }
    if (!chatKeyB64) {
      alert('No CHAT_KEY found. Set CHAT_KEY in localStorage for demo.');
      return;
    }

    // import key then connect
    (async () => {
      keyRef.current = await importKeyFromBase64(chatKeyB64);

      // fetch history
      const url = new URL(SERVER + '/api/messages');
      url.searchParams.set('conversationId', conversationId);
      const res = await fetch(url.toString(), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const hist = await res.json();
      // decrypt history
      const decMsgs = await Promise.all(hist.map(async m => {
        if (m.ciphertext) {
          const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);
          return { ...m, text: pt ?? '<unable to decrypt>' };
        }
        return m;
      }));
      setMessages(decMsgs);

      // connect socket
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
    })();

    return () => {
      try { socketRef.current?.disconnect(); } catch {}
    };
  }, [token, chatKeyB64, conversationId]);

  const send = async () => {
    if (!text.trim()) return;
    const k = keyRef.current;
    if (!k) return;
    const { ciphertext, iv } = await encryptText(k, text.trim());
    socketRef.current.emit('send_message', { roomId: conversationId, ciphertext, iv }, (ack) => {
      // optional handling
    });
    setText('');
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto border rounded p-4">
        <h2 className="text-lg font-semibold mb-3">Conversation: {conversationId}</h2>
        <div className="space-y-2 mb-4" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          {messages.map((m) => (
            <div key={m._id ?? m.ts} className="p-2 rounded bg-gray-100">
              <div className="text-xs text-gray-500">{m.fromEmail ?? m.from} · {new Date(m.ts).toLocaleString()}</div>
              <div className="mt-1">{m.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} className="flex-1 border rounded px-3 py-2" />
          <button onClick={send} className="px-4 py-2 bg-blue-600 text-white rounded">Send</button>
        </div>
      </div>
    </div>
  );
}
