# ChatApp - Full-Stack Encrypted Chat MVP

A secure, real-time chat application with end-to-end encryption, built with Node.js/Express, MongoDB, Socket.IO, and React.

## Features

### ✅ Core Features (MVP)

- **Secure Authentication**
  - Email/password registration with email verification
  - JWT-based access tokens (2h expiry)
  - Email verification via Ethereal (dev) or SMTP (production)

- **Real-Time Messaging**
  - Socket.IO with room-based conversations
  - End-to-end client-side AES-GCM encryption
  - Messages persist encrypted in MongoDB (ciphertext + IV)

- **Typing Indicators & Presence**
  - Real-time typing indicators
  - User online/offline status
  - Socket-based presence updates

- **Message Status**
  - Sent, Delivered, Read status tracking
  - Automatic status updates via socket acks

- **Attachments**
  - S3 signed URL uploads (or local fallback)
  - Support for images, videos, audio, PDFs
  - 10MB file size limit

- **Offline Queue**
  - IndexedDB-based message queue
  - Automatic flush on reconnection
  - Retry logic with max 3 attempts

- **Key Rotation**
  - Server-managed conversation-level encryption keys
  - Secure key rotation API (creator-only)
  - HTTPS-delivered keys with JWT auth

- **Modern UI**
  - Tailwind CSS styling
  - Responsive design (mobile/desktop)
  - Dark mode support
  - Message bubbles with avatars
  - Date separators
  - Typing indicators

## Tech Stack

### Backend
- Node.js + Express
- MongoDB (Mongoose)
- Socket.IO
- Nodemailer (Ethereal for dev)
- AWS SDK (S3 signed URLs, optional)
- Multer (file uploads, local fallback)

### Frontend
- React (Vite)
- Tailwind CSS
- Socket.IO Client
- IndexedDB (idb wrapper)
- Web Crypto API (AES-GCM)

## Setup

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or Atlas)
- (Optional) AWS S3 bucket for attachments

### Installation

1. **Clone and install dependencies:**

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

2. **Configure environment variables:**

**Server (.env):**
```bash
cp .env.example .env
```

Edit `.env`:
```env
MONGO_URI=mongodb://localhost:27017/chatapp
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_change_me
CLIENT_URL=http://localhost:5173

# Email (leave empty for Ethereal auto-setup in dev)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# AWS S3 (optional - falls back to local storage)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_REGION=us-east-1
```

**Client (client/.env):**
```bash
cd client
cp .env.example .env
```

Edit `client/.env`:
```env
VITE_SERVER_URL=http://localhost:3000
```

3. **Start the servers:**

**Terminal 1 - Backend:**
```bash
node src/server.js
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

### Registration & Email Verification

1. Register a new account with email/password
2. Check server console for Ethereal email credentials (dev mode)
3. Visit https://ethereal.email and login with credentials shown in console
4. Open verification email and click the verification link
5. Login with your credentials

### Creating Conversations

1. Navigate to Conversations page
2. Enter conversation title and participant emails (comma-separated)
3. Click "Create"
4. Open the conversation to start chatting

### Sending Messages

- Type message and press Enter (or click Send)
- Messages are encrypted client-side before sending
- Server stores only ciphertext + IV
- Recipients decrypt messages client-side

### Attachments

1. Click attachment icon in chat input
2. Select file (max 10MB)
3. File uploads to S3 (or local storage if S3 not configured)
4. Attachment metadata included in message

### Key Rotation

1. As conversation creator, call:
```bash
POST /api/conversations/rotate-key/:id
Authorization: Bearer <token>
```

2. New key is generated and stored
3. Participants should fetch new key:
```bash
GET /api/conversations/:id/key
Authorization: Bearer <token>
```

**Security Note:** This is MVP-only. For production, implement per-user public-key encryption for secure key delivery.

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `GET /api/auth/verify-email?token=...` - Verify email
- `POST /api/auth/login` - Login

### Conversations
- `GET /api/conversations` - List user's conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation
- `GET /api/conversations/:id/key` - Get conversation key
- `POST /api/conversations/rotate-key/:id` - Rotate key (creator only)

### Messages
- `GET /api/messages?conversationId=...` - Get message history

### Attachments
- `GET /api/attachments/signed-url?filename=...&contentType=...&conversationId=...` - Get upload URL

## Socket Events

### Client → Server
- `join_conversation` - Join conversation room
- `send_message` - Send encrypted message
- `typing` - User is typing
- `stop_typing` - User stopped typing
- `presence:online` - Broadcast online status
- `message_status_update` - Update message status (delivered/read)

### Server → Client
- `message` - New message received
- `user_typing` - User typing indicator
- `user_stopped_typing` - User stopped typing
- `message_status` - Message status update
- `presence:update` - User presence change

## Security Notes

### MVP Limitations

1. **Key Storage:** Server stores conversation keys in plaintext (MVP). For production:
   - Encrypt keys with server master key at rest
   - Use per-user public-key encryption for key delivery
   - Implement OTR-style key exchange or Signal protocol

2. **Email Verification:** Uses short-lived tokens (24h). For production:
   - Implement token rotation
   - Add rate limiting
   - Use secure email service (SendGrid, AWS SES)

3. **File Uploads:** Local fallback stores files on server. For production:
   - Use S3 with proper IAM policies
   - Implement virus scanning
   - Add file type validation

### Best Practices

- Change `JWT_SECRET` in production
- Use HTTPS in production
- Implement rate limiting
- Add input validation and sanitization
- Monitor for suspicious activity
- Regular security audits

## Development

### Project Structure

```
.
├── src/                    # Server source
│   ├── models/            # Mongoose models
│   ├── routes/            # Express routes
│   ├── middleware/        # Auth middleware
│   ├── utils/             # Utilities (JWT, mailer, S3)
│   └── server.js          # Main server file
├── client/                # React frontend
│   └── src/
│       ├── components/    # React components
│       ├── pages/         # Page components
│       ├── utils/         # Client utilities
│       └── main.jsx       # Entry point
└── README.md
```

### Testing

Manual test checklist:

1. ✅ Register two users
2. ✅ Verify emails via Ethereal
3. ✅ Login both users
4. ✅ Create conversation with both participants
5. ✅ Send messages (verify encryption/decryption)
6. ✅ Test typing indicators
7. ✅ Test message status updates
8. ✅ Upload attachment
9. ✅ Test offline queue (disconnect, send message, reconnect)
10. ✅ Test key rotation

## Troubleshooting

### Email Verification Not Working

- Check server console for Ethereal credentials
- Visit https://ethereal.email and login
- Check spam folder
- Verify `CLIENT_URL` matches your frontend URL

### Socket Connection Issues

- Verify `VITE_SERVER_URL` in client `.env`
- Check CORS settings in `server.js`
- Verify JWT token is valid
- Check browser console for errors

### MongoDB Connection Issues

- Verify `MONGO_URI` is correct
- Ensure MongoDB is running
- Check network/firewall settings

### File Upload Fails

- If using S3: verify AWS credentials
- If using local: ensure `uploads/` directory exists
- Check file size (max 10MB)
- Verify file type is allowed

## License

MIT

## Contributing

This is an MVP. For production use, implement the security improvements noted above.
