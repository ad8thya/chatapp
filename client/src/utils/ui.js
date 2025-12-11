// client/src/utils/ui.js
// UI-only helpers — no backend changes
// Theme management and time formatting utilities

/**
 * Format timestamp to relative time or formatted date
 */
export function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format timestamp for message display (e.g., "2:34 PM")
 */
export function formatMessageTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Check if two timestamps are on different days
 */
export function isDifferentDay(ts1, ts2) {
  if (!ts1 || !ts2) return false;
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return d1.toDateString() !== d2.toDateString();
}

/**
 * Format date separator (e.g., "Today", "Yesterday", "Jan 15, 2024")
 */
export function formatDateSeparator(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/**
 * Get initials from email or name
 */
export function getInitials(emailOrName) {
  if (!emailOrName) return '?';
  const parts = emailOrName.trim().split(/[\s@]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return emailOrName.substring(0, 2).toUpperCase();
}

/**
 * Theme management (UI-only, persisted to localStorage)
 */
export function getTheme() {
  try {
    return localStorage.getItem('UI_THEME') || 'light';
  } catch {
    return 'light';
  }
}

export function setTheme(theme) {
  try {
    localStorage.setItem('UI_THEME', theme);
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    console.error('Failed to set theme', e);
  }
}

export function initTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
}

