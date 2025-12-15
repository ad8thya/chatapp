// client/src/components/TypingIndicator.jsx
// UI-only component — no backend changes
// Animated typing indicator with three dots

export default function TypingIndicator({ users = [] }) {
  if (!users || users.length === 0) return null;

  const names = users.join(', ');
  
  return (
    <div className="typing-indicator">
      <div className="typing-indicator__dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span className="typing-indicator__text">{names} {users.length === 1 ? 'is' : 'are'} typing...</span>
    </div>
  );
}







