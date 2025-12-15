// client/src/components/Avatar.jsx
// UI-only component — no backend changes
// Avatar component with initials fallback

import { getInitials } from '../utils/ui';

export default function Avatar({ email, name, size = 40, className = '' }) {
  const displayName = name || email || '';
  const initials = getInitials(displayName);
  const sizePx = `${size}px`;

  return (
    <div 
      className={`avatar ${className}`}
      style={{ width: sizePx, height: sizePx, fontSize: `${size * 0.4}px` }}
      title={displayName}
      aria-label={`Avatar for ${displayName}`}
    >
      {initials}
    </div>
  );
}











