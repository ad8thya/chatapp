


# Socket — End-to-End Encrypted Chat (Full-Stack MVP)

**Socket** is a real-time, end-to-end encrypted chat application built as a full-stack MVP.
It focuses on correct fundamentals: authentication, encryption, real-time delivery, offline handling, and clean system boundaries.

This project is intentionally opinionated and security-aware, while still being practical and hackable.

---

## ✨ What This App Does

* Authenticated, real-time messaging
* Client-side encryption (AES-GCM)
* Persistent encrypted storage
* Reliable delivery with status tracking
* Offline-first message queue
* Attachment uploads
* Conversation-level key rotation

The server **never sees plaintext messages**.

---

## 🚀 Core Features

### 🔐 Authentication

* Email + password authentication
* Email verification workflow
* JWT-based access tokens
* Protected REST and Socket.IO routes

### 💬 Real-Time Messaging

* Socket.IO room-based conversations
* Encrypted messages stored as ciphertext + IV
* Message lifecycle: **sent → delivered → read**

### 🔒 End-to-End Encryption

* AES-GCM encryption on the client
* Encryption happens before messages leave the browser
* Decryption happens only on recipient clients

### 🔄 Offline Support

* IndexedDB-backed offline queue
* Messages retry automatically on reconnection
* Guaranteed ordering and delivery attempts

### 🔑 Key Management

* Conversation-level symmetric keys
* Secure key fetch via authenticated API
* Creator-only key rotation endpoint

### 📎 Attachments

* Image, video, audio, and PDF support
* Signed uploads (S3) or local fallback
* 10MB size limit

### 👀 Presence & Typing

* Online / offline indicators
* Live typing notifications
* Socket-driven presence updates

---

## 🧠 Tech Stack

### Backend

* Node.js + Express
* MongoDB + Mongoose
* Socket.IO
* JWT authentication
* Multer (local uploads)
* AWS S3 (optional)

### Frontend

* React (Vite)
* Tailwind CSS
* Socket.IO Client
* Web Crypto API (AES-GCM)
* IndexedDB (offline queue)

---

## 📁 Project Structure

```
.
├── src/                  # Backend
│   ├── models/           # MongoDB models
│   ├── routes/           # REST APIs
│   ├── middleware/       # Auth & guards
│   ├── utils/            # JWT, mailer, storage
│   └── server.js
│
├── client/               # Frontend (Vite + React)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── utils/
│       └── main.jsx
│
└── README.md
```

---

## ⚙️ Local Setup

### Prerequisites

* Node.js 18+
* MongoDB (local or Atlas)

### Install Dependencies

```bash
npm install
cd client
npm install
cd ..
```

### Environment Variables

#### Server (`.env`)

```env
MONGO_URI=mongodb://localhost:27017/chatapp
PORT=3000
JWT_SECRET=change_this
CLIENT_URL=http://localhost:5173
```

#### Client (`client/.env`)

```env
VITE_SERVER_URL=http://localhost:3000
```

### Run Locally

**Backend**

```bash
node src/server.js
```

**Frontend**

```bash
cd client
npm run dev
```

App runs at `http://localhost:5173`.

---

## 🔌 API Overview

### Auth

* `POST /api/auth/register`
* `GET /api/auth/verify-email`
* `POST /api/auth/login`

### Conversations

* `GET /api/conversations`
* `POST /api/conversations`
* `GET /api/conversations/:id`
* `GET /api/conversations/:id/key`
* `POST /api/conversations/rotate-key/:id`

### Messages

* `GET /api/messages?conversationId=...`

### Attachments

* `GET /api/attachments/signed-url`

---

## 🔁 Socket Events

### Client → Server

* `join_conversation`
* `send_message`
* `typing`
* `stop_typing`
* `message_status_update`

### Server → Client

* `message`
* `message_status`
* `user_typing`
* `presence:update`

---

## 🔐 Security Notes (Important)

This is an MVP built with **correct boundaries**, not a finished Signal clone.

### Current Limitations

* Conversation keys are server-stored (plaintext)
* No public-key key exchange
* No rate limiting or abuse detection

### Production Improvements

* Encrypt keys at rest
* Per-user public-key key delivery
* Rate limiting and audit logging
* HTTPS-only enforcement

---

## 🧪 Manual Test Checklist

* Register + verify users
* Login from multiple clients
* Create conversations
* Send encrypted messages
* Test offline queue
* Upload attachments
* Rotate conversation keys
* Verify presence and typing

---

## 🎯 Why This Project Exists

This project was built to:

* Understand real-time systems deeply
* Implement encryption correctly
* Handle offline reliability
* Avoid framework magic
* Learn by building the hard parts

---

## 📜 License

MIT

---

