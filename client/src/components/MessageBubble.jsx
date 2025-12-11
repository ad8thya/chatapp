// client/src/components/MessageBubble.jsx
// UI-only component — no backend changes
// Message bubble with sender info, timestamp, and decryption status indicator

import { formatMessageTime } from '../utils/ui';
import Avatar from './Avatar';

export default function MessageBubble({ message, isMine, showAvatar = true, showSender = true }) {
  const isDecryptionFailed = message.text === '<unable to decrypt>';
  
  return (
    <div className={`message-bubble ${isMine ? 'message-bubble--mine' : 'message-bubble--theirs'}`}>
      {!isMine && showAvatar && (
        <Avatar 
          email={message.fromEmail || message.from} 
          size={32} 
          className="message-bubble__avatar"
        />
      )}
      <div className="message-bubble__content">
        {!isMine && showSender && (
          <div className="message-bubble__sender">
            {message.fromEmail || message.from || 'Unknown'}
          </div>
        )}
        <div className="message-bubble__text">
          {isDecryptionFailed ? (
            <span className="message-bubble__decrypt-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }}>
                <path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm1 12H7v-2h2v2zm0-3H7V4h2v5z" fill="currentColor"/>
              </svg>
              Unable to decrypt
            </span>
          ) : (
            message.text
          )}
        </div>
        <div className="message-bubble__meta">
          <span className="message-bubble__time">{formatMessageTime(message.ts)}</span>
          {isMine && (
            <span className="message-bubble__status" title={message.status === 'read' ? 'Read' : message.status === 'delivered' ? 'Delivered' : 'Sent'}>
              {message.status === 'read' ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.5 2L6 9.5 2.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 9.5L13.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : message.status === 'delivered' ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.5 2L6 9.5 2.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2"/>
                </svg>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

