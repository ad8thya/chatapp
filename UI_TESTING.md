# UI Makeover Testing Checklist

## Overview
This document provides a testing checklist for the UI-only makeover. All backend, socket, encryption, and API logic remains unchanged.

## Pre-Testing Setup

1. **Install dependencies** (if needed):
   ```bash
   cd client
   npm install
   ```

2. **Start the development server**:
   ```bash
   # Terminal 1: Start backend
   cd ..
   npm start  # or node src/server.js

   # Terminal 2: Start frontend
   cd client
   npm run dev
   ```

3. **Verify theme initialization**: Check browser console for any errors on page load. Theme should initialize from `localStorage.UI_THEME` or default to 'light'.

## Visual Testing Checklist

### ✅ Desktop Layout (≥1024px)

#### Conversations Page
- [ ] Two-column layout: sidebar (left) with conversation list, create form (right)
- [ ] Search box appears in sidebar header
- [ ] Conversation items show avatar, title, and metadata
- [ ] Hover effects on conversation items (border color, shadow, slight lift)
- [ ] Create conversation form is styled and responsive
- [ ] Loading spinner appears while fetching
- [ ] Empty state message is centered and styled

#### Chat Page
- [ ] Full-width chat container with fixed height
- [ ] Message bubbles align left (others) and right (mine)
- [ ] Date separators appear between different days
- [ ] Message bubbles have proper spacing and max-width (75%)
- [ ] Input area has resizable textarea (up to 4 lines)
- [ ] Attach and emoji buttons visible (disabled, UI-only)
- [ ] Send button has icon and proper styling
- [ ] Empty state shows when no messages

#### Header
- [ ] User avatar appears next to email
- [ ] Theme toggle button visible and functional
- [ ] Logout button styled correctly
- [ ] Navigation links work

### ✅ Mobile Layout (<640px)

#### Conversations Page
- [ ] Single column layout (sidebar stacks above form)
- [ ] Search box remains accessible
- [ ] Conversation items are touch-friendly (large tap targets)
- [ ] Form inputs stack vertically

#### Chat Page
- [ ] Full-screen chat (no side margins)
- [ ] Message bubbles max-width increased to 85%
- [ ] Input area remains accessible
- [ ] Header compresses appropriately

### ✅ Dark Mode

1. **Toggle theme**:
   - [ ] Click theme toggle in header
   - [ ] Colors switch smoothly (no flash)
   - [ ] Theme persists after page reload (check `localStorage.UI_THEME`)

2. **Verify dark mode styling**:
   - [ ] Background is dark (`#0f172a`)
   - [ ] Cards are dark gray (`#1e293b`)
   - [ ] Text is light (`#f1f5f9`)
   - [ ] Borders are visible
   - [ ] All components readable with proper contrast

### ✅ Message Bubbles

1. **Visual appearance**:
   - [ ] My messages: blue gradient, right-aligned, rounded corners
   - [ ] Other messages: white/card color, left-aligned, rounded corners
   - [ ] Timestamps visible and properly formatted
   - [ ] Status icons appear on sent messages (mine only)

2. **Decryption status**:
   - [ ] Messages that decrypt show normal text
   - [ ] Messages with `<unable to decrypt>` show red warning icon + text
   - [ ] Warning is visible in both light and dark mode

3. **Date separators**:
   - [ ] "Today" appears for today's messages
   - [ ] "Yesterday" appears for yesterday's messages
   - [ ] Full date appears for older messages
   - [ ] Separators have horizontal lines on both sides

### ✅ Typography & Spacing

- [ ] Font is Inter (or system fallback)
- [ ] Base font size is 16px
- [ ] Secondary text is 14px or smaller
- [ ] Line height is comfortable (1.5)
- [ ] Message text wraps properly (no overflow)
- [ ] Consistent spacing throughout (using CSS variables)

### ✅ Animations & Interactions

- [ ] Message bubbles fade in when received
- [ ] Hover states on buttons (color change, slight lift)
- [ ] Focus states visible (outline on keyboard navigation)
- [ ] Typing indicator animates (3 dots bouncing)
- [ ] Smooth transitions on theme toggle
- [ ] Input focus has blue glow

### ✅ Accessibility

- [ ] Keyboard navigation works (Tab through interactive elements)
- [ ] Focus indicators visible (2px outline)
- [ ] ARIA labels on icon buttons
- [ ] Color contrast meets WCAG AA (test with browser dev tools)
- [ ] Form inputs have proper labels (even if visually hidden)
- [ ] Error messages are readable and styled

## Functional Testing (Verify No Logic Changes)

### ✅ Message Sending & Receiving

1. **Send a message**:
   - [ ] Type message and press Enter (or click Send)
   - [ ] Message appears in chat immediately
   - [ ] Message is encrypted and sent via socket (check network tab)
   - [ ] Server receives message correctly (check server logs)

2. **Receive a message** (from another tab/user):
   - [ ] Message appears in chat
   - [ ] Message decrypts correctly
   - [ ] Message appears in correct position (left/right based on sender)
   - [ ] No duplicate messages appear

3. **History loading**:
   - [ ] Reload page
   - [ ] Previous messages load and decrypt
   - [ ] Messages appear in chronological order
   - [ ] Date separators appear correctly

### ✅ Authentication Flow

- [ ] Login page loads and submits correctly
- [ ] Register page loads and submits correctly
- [ ] Token is stored in localStorage
- [ ] Redirect to conversations after login/register works
- [ ] Logout clears token and redirects to login

### ✅ Socket Connection

- [ ] Socket connects on chat page load
- [ ] Console shows "socket connected: <id>"
- [ ] Join conversation acknowledgment appears
- [ ] Reconnection works if network drops
- [ ] No "socket not connected" errors when sending

### ✅ Encryption/Decryption

- [ ] Messages encrypt before sending (check network payload)
- [ ] Messages decrypt on receive
- [ ] Both users in same conversation can decrypt each other's messages
- [ ] Failed decryption shows warning icon (UI-only, doesn't break flow)

## Regression Testing

### ✅ Existing Features Still Work

- [ ] Can create new conversations
- [ ] Can join existing conversations
- [ ] Can send encrypted messages
- [ ] Can receive and decrypt messages
- [ ] Socket reconnection works
- [ ] No duplicate messages
- [ ] Message history loads correctly
- [ ] Authentication flow unchanged

### ✅ No Console Errors

- [ ] Open browser console (F12)
- [ ] Navigate through all pages
- [ ] Send/receive messages
- [ ] Toggle theme
- [ ] Verify no new errors introduced (only existing ones if any)

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, if on Mac)

## Performance

- [ ] Page loads quickly
- [ ] No layout shifts (CLS)
- [ ] Smooth scrolling in message list
- [ ] Theme toggle is instant
- [ ] No memory leaks (check with DevTools Performance tab)

## Acceptance Criteria

✅ **All criteria must pass:**

1. ✅ All message sending and decryption behavior remains unchanged
2. ✅ No WebSocket event names or payload shapes changed
3. ✅ After UI changes, conversation pages load correctly
4. ✅ Sending messages works exactly as before
5. ✅ Encrypted messages decrypt and show plaintext in message bubbles
6. ✅ No new runtime console errors introduced
7. ✅ Mobile and desktop layouts render correctly
8. ✅ Dark mode works and persists
9. ✅ All interactive elements are accessible via keyboard
10. ✅ Visual polish matches design goals (Telegram/Slack-lite aesthetic)

## Quick Test Scenarios

### Scenario 1: Two Users Chat
1. Open two browser windows (or incognito + normal)
2. Login as User A in window 1, User B in window 2
3. Create conversation with both users
4. Send message from User A
5. Verify User B receives and decrypts message
6. Send reply from User B
7. Verify User A receives and decrypts message
8. Check both UIs show proper message bubbles and alignment

### Scenario 2: Theme Toggle
1. Load app in light mode
2. Toggle to dark mode
3. Verify colors change smoothly
4. Reload page
5. Verify dark mode persists
6. Toggle back to light
7. Verify light mode works

### Scenario 3: Mobile Responsive
1. Open DevTools, set to mobile viewport (375px width)
2. Navigate to conversations page
3. Verify single-column layout
4. Open a chat
5. Verify full-screen chat
6. Send a message
7. Verify message bubbles are properly sized

## Notes

- All backend code, socket handlers, encryption logic, and API endpoints remain **completely unchanged**
- Only presentation (CSS, component markup, UI helpers) was modified
- If any functional issues arise, they are likely unrelated to UI changes and should be investigated separately




