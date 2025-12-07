// client/src/pages/Chat.jsx

// Changes:

// 1) Prevent double socket initialization in React StrictMode using initRef.

// 2) Deduplicate incoming messages by _id to avoid duplicates if server or client causes echoes.

// 3) Keep robust base64 <-> ArrayBuffer helpers and safe key import (regen only if missing or clearly invalid).

// 4) Add small non-sensitive console logs to help debug.

import * as React from 'react';

const { useEffect, useState, useRef } = React;

import { io } from 'socket.io-client';

import { useParams } from 'react-router-dom';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

// Web Crypto helpers

const enc = new TextEncoder();

const dec = new TextDecoder();

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

  const binary = atob(b64);

  const len = binary.length;

  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

  return bytes.buffer;

}

// key helpers

function generateChatKeyBase64AndSave() {

  const raw = crypto.getRandomValues(new Uint8Array(32));

  const keyB64 = arrayBufferToBase64(raw.buffer);

  try { localStorage.setItem('CHAT_KEY', keyB64); } catch (e) {}

  return keyB64;

}

async function importKeyFromBase64(b64) {

  // If missing, create and persist a valid 32 byte key.

  if (!b64 || typeof b64 !== 'string') {

    const newKey = generateChatKeyBase64AndSave();

    return crypto.subtle.importKey('raw', base64ToArrayBuffer(newKey), 'AES-GCM', true, ['encrypt','decrypt']);

  }

  const trimmed = b64.trim();

  // base64 length for 32 bytes is 44 chars (with padding)

  if (trimmed.length !== 44) {

    console.warn('CHAT_KEY length unexpected — NOT regenerating automatically here. Please ensure consistent CHAT_KEY across tabs for shared rooms.');

    // Still try to import if possible (avoid regeneration causing mismatch)

    try { return crypto.subtle.importKey('raw', base64ToArrayBuffer(trimmed), 'AES-GCM', true, ['encrypt','decrypt']); }

    catch (e) { 

      const newKey = generateChatKeyBase64AndSave();

      return crypto.subtle.importKey('raw', base64ToArrayBuffer(newKey), 'AES-GCM', true, ['encrypt','decrypt']);

    }

  }

  return crypto.subtle.importKey('raw', base64ToArrayBuffer(trimmed), 'AES-GCM', true, ['encrypt','decrypt']);

}

async function encryptText(keyObj, plaintext) {

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ptBuf = enc.encode(plaintext);

  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, ptBuf);

  return { ciphertext: arrayBufferToBase64(ctBuf), iv: arrayBufferToBase64(iv.buffer) };

}

async function decryptText(keyObj, ciphertextB64, ivB64) {

  try {

    const ctBuf = base64ToArrayBuffer(String(ciphertextB64 || ''));

    const ivBuf = base64ToArrayBuffer(String(ivB64 || ''));

    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(ivBuf) }, keyObj, ctBuf);

    return dec.decode(plainBuf);

  } catch (e) {

    console.error('decryptText failed', e && e.message);

    return null;

  }

}

function decodeJwt(token) {

  try {

    const parts = token.split('.');

    if (parts.length !== 3) return null;

    return JSON.parse(atob(parts[1]));

  } catch (e) { return null; }

}

export default function Chat() {

  const { conversationId } = useParams();

  const [token] = useState(() => { try { return localStorage.getItem('TOKEN'); } catch (e) { return null; } });

  const [chatKeyB64] = useState(() => { try { return localStorage.getItem('CHAT_KEY'); } catch (e) { return null; } });

  const currentUserEmail = token ? (decodeJwt(token)?.email || decodeJwt(token)?.sub) : null;

  const [messages, setMessages] = useState([]);

  const [text, setText] = useState('');

  const socketRef = useRef(null);

  const keyRef = useRef(null);

  const bottomRef = useRef();

  // Guard so effect only initializes socket once (handles React StrictMode double mount)

  const initRef = useRef(false);

  useEffect(() => {

    if (initRef.current) return; // already initialized

    initRef.current = true;

    if (!token) {

      console.warn('No TOKEN; aborting chat init.');

      return;

    }

    if (!chatKeyB64) {

      console.warn('No CHAT_KEY in localStorage; aborting chat init.');

      return;

    }

    let mounted = true;

    (async () => {

      try {

        keyRef.current = await importKeyFromBase64(chatKeyB64);

        // fetch history

        const url = new URL(SERVER + '/api/messages');

        url.searchParams.set('conversationId', conversationId);

        const res = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + token }});

        if (!res.ok) {

          console.error('History fetch failed', await res.text());

          if (mounted) setMessages([]);

        } else {

          const hist = await res.json();

          if (Array.isArray(hist)) {

            const decMsgs = await Promise.all(hist.map(async m => {

              if (m.ciphertext && m.iv) {

                const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);

                return { ...m, text: pt ?? '<unable to decrypt>' };

              }

              return m;

            }));

            if (mounted) setMessages(decMsgs);

          } else {

            if (mounted) setMessages([]);

          }

        }

        // create socket only once

        if (!socketRef.current) {

          const s = io(SERVER, { auth: { token } });

          socketRef.current = s;

          s.on('connect', () => {

            console.log('socket connected', s.id);

            s.emit('join_conversation', conversationId, () => {});

          });

          s.on('message', async (m) => {

            try {

              // Save last message for debugging

              window.__debug_last_msg = m;

              // small logs

              console.log('INCOMING raw ->', { id: m._id, cipher_len: (m.ciphertext||'').length, iv_len: (m.iv||'').length });

              // DEDUPE: ignore if we already have this message by _id

              if (m._id && messages.some(msg => String(msg._id) === String(m._id))) {

                console.log('Duplicate message ignored _id=', m._id);

                return;

              }

              if (m.ciphertext && m.iv) {

                const pt = await decryptText(keyRef.current, m.ciphertext, m.iv);

                const final = { ...m, text: pt ?? '<unable to decrypt>' };

                setMessages(prev => {

                  // double-check dedupe in state update

                  if (final._id && prev.some(x => String(x._id) === String(final._id))) return prev;

                  return [...prev, final];

                });

                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

              } else if (m.text) {

                setMessages(prev => {

                  if (m._id && prev.some(x => String(x._id) === String(m._id))) return prev;

                  return [...prev, m];

                });

                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

              }

            } catch (err) {

              console.error('Error handling incoming message', err);

            }

          });

          s.on('connect_error', (err) => {

            console.error('socket connect_error', err);

          });

        }

      } catch (err) {

        console.error('Chat init error', err);

        if (mounted) setMessages([]);

      }

    })();

    return () => {

      initRef.current = false;

      socketRef.current?.disconnect();

      socketRef.current = null;

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [conversationId]); // intentionally limited deps to avoid double init

  const send = async () => {

    if (!text.trim()) return;

    if (!socketRef.current || !socketRef.current.connected) {

      alert('Socket not connected. Check TOKEN or refresh.');

      return;

    }

    const k = keyRef.current;

    if (!k) return;

    const { ciphertext, iv } = await encryptText(k, text.trim());

    // emit, do NOT locally append — server will echo back (dedupe prevents duplicates)

    socketRef.current.emit('send_message', { roomId: conversationId, ciphertext, iv }, (ack) => {

      if (!ack || !ack.ok) console.warn('send ack failed', ack);

    });

    setText('');

  };

  const isMyMessage = (message) => {

    const msgEmail = message.fromEmail || message.from;

    return currentUserEmail && msgEmail && msgEmail.toLowerCase() === currentUserEmail.toLowerCase();

  };

  return (

    <div className="chat-page">

      <div className="chat-container">

        <div className="chat-header">

          <h2 className="chat-header-title">Conversation: {conversationId}</h2>

          <div className="chat-header-actions">

            <button onClick={() => { localStorage.removeItem('TOKEN'); window.location.href = '/login'; }}>Logout</button>

          </div>

        </div>

        <div className="chat-messages">

          {messages.length === 0 && <div className="conversations-empty">No messages yet. Start the conversation!</div>}

          {messages.map((m) => {

            const mine = isMyMessage(m);

            return (

              <div key={m._id ?? m.ts} className={`chat-message ${mine ? 'chat-message-mine' : 'chat-message-theirs'}`}>

                <div className="chat-message-meta">

                  <span>{m.fromEmail ?? m.from}</span><span>·</span><span>{new Date(m.ts).toLocaleString()}</span>

                </div>

                <div className="chat-message-text">{m.text}</div>

              </div>

            );

          })}

          <div ref={bottomRef} />

        </div>

        <div className="chat-input-container">

          <input className="chat-input" value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..." />

          <button onClick={send} className="btn btn-primary chat-send-button" disabled={!text.trim()}>Send</button>

        </div>

      </div>

    </div>

  );

}
