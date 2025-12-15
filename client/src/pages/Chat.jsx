
// client/src/pages/Chat.jsx
// Full-featured chat with typing, status, attachments, offline queue
import * as React from 'react';
const { useEffect, useState, useRef, useCallback } = React;
import { io } from 'socket.io-client';
import { useParams, useNavigate } from 'react-router-dom';
import MessageBubble from '../components/MessageBubble';
import TypingIndicator from '../components/TypingIndicator';
import { formatDateSeparator } from '../utils/ui';
import { addUnsentMessage, flushUnsent } from '../utils/offlineQueue';
import { getAuthHeader } from '../utils/auth';
import { useAuthContext } from '../context/AuthContext';

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
  const { token, user, loading: authLoading } = useAuthContext();
  const nav = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const socketRef = useRef(null);
  const keyRef = useRef(null);
  const bottomRef = useRef();
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  
  if (authLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!token || !user) {
    nav('/login');
    return null;
  }

  const currentUserEmail = user.email;

  // Send message helper (used by send and offline queue flush)
  const sendMessage = useCallback(async (payload) => {
    if (!socketRef.current || !socketRef.current.connected) {
      // Queue for offline
      await addUnsentMessage(conversationId, payload);
      return false;
    }
    
    return new Promise((resolve) => {
      socketRef.current.emit('send_message', payload, (ack) => {
        if (ack?.ok) {
          resolve(true);
        } else {
          // Queue on failure
          addUnsentMessage(conversationId, payload);
          resolve(false);
        }
      });
    });
  }, [conversationId]);

  useEffect(() => {
    if (!token || !user) return;
    let mounted = true;

    (async () => {
      try {
        // Fetch conversation key
        const res = await fetch(`${SERVER}/api/conversations/${conversationId}/key`, {
          headers: { ...getAuthHeader(token) }
        });
        if (!res.ok) {
          if (res.status === 401) {
            nav('/login');
            return;
          }
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
        
        // Fetch history
        const url = new URL(SERVER + '/api/messages');
        url.searchParams.set('conversationId', conversationId);
        const histRes = await fetch(url.toString(), { headers: { ...getAuthHeader(token) } });
        if (!histRes.ok) {
          if (histRes.status === 401) {
            nav('/login');
            return;
          }
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

        // Connect socket
        if (!socketRef.current) {
          const s = io(SERVER, {
            auth: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            timeout: 10000
          });

          socketRef.current = s;
          window.__chat_socket = s;

          s.on('connect', async () => {
            console.info('socket connected:', s.id);
            s.emit('join_conversation', conversationId, (ack) => {
              console.info('join ack:', ack);
            });
            
            // Broadcast online presence
            s.emit('presence:online');
            
            // Flush offline queue on reconnect
            if (mounted) {
              const result = await flushUnsent(conversationId, sendMessage);
              if (result.sent > 0) {
                console.log(`Flushed ${result.sent} queued messages`);
              }
            }
          });

          s.on('connect_error', (err) => {
            console.error('socket connect_error:', err?.message || err);
          });

          s.on('reconnect_attempt', (attempt) => {
            console.warn('socket reconnect_attempt:', attempt);
          });

          s.on('disconnect', (reason) => {
            console.warn('socket disconnected:', reason);
          });

          // Message handler with deduplication
          s.on('message', async (m) => {
            window.__debug_last_msg = m;
            
            // Dedupe by _id
            setMessages(prev => {
              if (prev.some(msg => String(msg._id) === String(m._id))) {
                return prev;
              }
              
              // Decrypt and add
              if (m.ciphertext && m.iv) {
                decryptText(keyRef.current, m.ciphertext, m.iv).then(pt => {
                  setMessages(prevMsgs => {
                    const existing = prevMsgs.find(msg => String(msg._id) === String(m._id));
                    if (existing) return prevMsgs;
                    const newMsg = { ...m, text: pt ?? '<unable to decrypt>', status: m.status || 'sent' };
                    
                    // If I'm not the sender, emit delivered receipt (compare by email)
                    const fromEmail = m.fromEmail || m.from;
                    if (fromEmail && fromEmail.toLowerCase() !== currentUserEmail.toLowerCase()) {
                      s.emit('message_delivered', { messageId: m._id });
                    }
                    
                    return [...prevMsgs, newMsg];
                  });
                });
                return prev; // Return prev while decrypting
              }
              
              // If I'm not the sender, emit delivered receipt (compare by email)
              const fromEmail = m.fromEmail || m.from;
              if (fromEmail && fromEmail.toLowerCase() !== currentUserEmail.toLowerCase()) {
                s.emit('message_delivered', { messageId: m._id });
              }
              
              return [...prev, { ...m, status: m.status || 'sent' }];
            });
            
            // Scroll to bottom
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          });

          // Typing indicators
          s.on('user_typing', (data) => {
            if (data.email !== currentUserEmail) {
              setTypingUsers(prev => {
                if (!prev.includes(data.email)) {
                  return [...prev, data.email];
                }
                return prev;
              });
              
              // Auto-remove after 3 seconds
              setTimeout(() => {
                setTypingUsers(prev => prev.filter(u => u !== data.email));
              }, 3000);
            }
          });

          s.on('user_stopped_typing', (data) => {
            setTypingUsers(prev => prev.filter(u => u !== data.email));
          });

          // Message status updates
          s.on('message_status', (data) => {
            setMessages(prev => prev.map(msg => 
              String(msg._id) === String(data.messageId)
                ? { ...msg, status: data.status }
                : msg
            ));
          });

          // Presence updates
          s.on('presence:update', (data) => {
            // Could update UI to show online/offline status
            console.log('Presence update:', data);
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
  }, [token, user, conversationId, sendMessage, currentUserEmail]);

  // Typing handler
  const handleTyping = useCallback(() => {
    if (!socketRef.current?.connected) return;
    
    socketRef.current.emit('typing', { conversationId });
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop_typing', { conversationId });
    }, 2000);
  }, [conversationId]);

  // Mark messages as read when they're visible
  useEffect(() => {
    if (!socketRef.current?.connected || !conversationId) return;

    // Find unread messages from other users (compare by email)
    const unreadMessageIds = messages
      .filter(m => {
        const fromEmail = m.fromEmail || m.from;
        return fromEmail && fromEmail.toLowerCase() !== currentUserEmail.toLowerCase() && m.status !== 'read';
      })
      .map(m => m._id);

    // Batch mark as read (debounce to avoid too many emits)
    if (unreadMessageIds.length > 0) {
      const timeoutId = setTimeout(() => {
        if (socketRef.current?.connected) {
          socketRef.current.emit('message_read', {
            messageIds: unreadMessageIds,
            conversationId: conversationId
          });
        }
      }, 1000); // Wait 1 second after messages are loaded/visible

      return () => clearTimeout(timeoutId);
    }
  }, [messages, conversationId, currentUserEmail]);

  // File upload handler
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File too large (10MB max)');
      return;
    }

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(`${SERVER}/api/attachments/upload`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(token),
        },
        body: form,
      });
      if (res.status === 401) {
        nav('/login');
        return;
      }
      if (!res.ok) throw new Error('Upload failed');

    const data = await res.json();

    setAttachments(prev => [
      ...prev,
      {
        url: data.url,
        filename: data.filename,
        mime: data.mime,
        size: data.size,
      }
    ]);

    fileInputRef.current.value = '';
  } catch (err) {
    console.error(err);
    alert('Upload failed');
  }
};


  const send = async () => {
    if (!text.trim() && attachments.length === 0) return;
    if (!keyRef.current) {
      alert('Encryption key not ready');
      return;
    }

    // Stop typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socketRef.current?.emit('stop_typing', { conversationId });

    // Encrypt text if present
    let ciphertext = '';
    let iv = '';
    if (text.trim()) {
      const encrypted = await encryptText(keyRef.current, text.trim());
      ciphertext = String(encrypted.ciphertext);
      iv = String(encrypted.iv);
    }

    const payload = {
      roomId: conversationId,
      ciphertext,
      iv,
      attachments: attachments.length > 0 ? attachments : undefined
    };

    await sendMessage(payload);
    setText('');
    setAttachments([]);
  };

  const isMyMessage = (m) => {
    const from = m.fromEmail || m.from;
    return currentUserEmail && from && from.toLowerCase() === currentUserEmail.toLowerCase();
  };

  // Group messages by date
  const messagesWithSeparators = [];
  let lastDate = null;
  messages.forEach((m, idx) => {
    const msgDate = m.ts ? new Date(m.ts).toDateString() : null;
    if (msgDate && msgDate !== lastDate) {
      messagesWithSeparators.push({ type: 'separator', date: m.ts });
      lastDate = msgDate;
    }
    messagesWithSeparators.push({ type: 'message', ...m });
  });

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <h2 className="chat-header-title">Conversation</h2>
        </div>

        <div className="chat-messages">
          {messagesWithSeparators.length === 0 && (
            <div className="chat-empty">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          {messagesWithSeparators.map((item, idx) => {
            if (item.type === 'separator') {
              return (
                <div key={`sep-${item.date}`} className="chat-date-separator">
                  <span>{formatDateSeparator(item.date)}</span>
                </div>
              );
            }
            const isMine = isMyMessage(item);
            const showAvatar = idx === 0 || messagesWithSeparators[idx - 1]?.type === 'separator' || 
                              (messagesWithSeparators[idx - 1]?.type === 'message' && 
                               (messagesWithSeparators[idx - 1].fromEmail || messagesWithSeparators[idx - 1].from) !== (item.fromEmail || item.from));
            return (
              <MessageBubble
                key={item._id ?? `msg-${idx}`}
                message={item}
                isMine={isMine}
                showAvatar={!isMine && showAvatar}
                showSender={!isMine}
              />
            );
          })}
          {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-container">
          {attachments.length > 0 && (
            <div className="chat-attachments-preview">
              {attachments.map((att, idx) => (
                <div key={idx} className="chat-attachment-item">
                  <span>{att.filename}</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>×</button>
                </div>
              ))}
            </div>
          )}
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={text}
              onChange={e => {
                setText(e.target.value);
                handleTyping();
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              style={{ 
                resize: 'none',
                overflow: 'hidden',
                minHeight: '40px',
                maxHeight: '120px'
              }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              aria-label="Message input"
            />
            <div className="chat-input-actions">
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,.pdf,.txt"
              />
              <button
                className="chat-input-button chat-input-button--attach"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 7.5V14.5C15 16.43 13.43 18 11.5 18S8 16.43 8 14.5V6C8 4.07 9.57 2.5 11.5 2.5S15 4.07 15 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <button
            onClick={send}
            disabled={!text.trim() && attachments.length === 0}
            className="btn btn-primary chat-send-button"
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 2L9 11M18 2l-7 17-3-7-7-3 17-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
