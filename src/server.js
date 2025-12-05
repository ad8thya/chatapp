// src/server.js
// Entrypoint for the chat server.
// - Loads env
// - Registers routes
// - Connects sockets
// - Connects to MongoDB (if MONGO_URI provided)

require('dotenv').config(); // must be first so process.env is populated

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Models & routes
const Message = require('./models/Message'); // ensure this file exists
const authRoutes = require('./routes/auth');
// If you implemented auth middleware, use it in your routes. If not, conversation route file has a dev stub.
const conversationsRoutes = require('./routes/conversations');
const messagesRoutes = require('./routes/messages');

const { verifyToken } = require('./utils/jwt'); // used for socket auth

const app = express();

// ---- Middleware (order matters) ----
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser()); // keep before routes that might read cookies

// ---- API routes (single mount per route) ----
app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/conversations', conversationsRoutes);

// ---- HTTP + Socket servers ----
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

// ---- Socket auth ----
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Auth error: token required'));
  try {
    const payload = verifyToken(token); // should throw if invalid
    socket.user = payload; // { id, email, ... }
    return next();
  } catch (err) {
    return next(new Error('Auth error: invalid token'));
  }
});

// ---- Socket events ----
io.on('connection', (socket) => {
  console.log('socket connected user:', socket.user?.email, socket.id);

  socket.on('join_conversation', (conversationId, cb) => {
    socket.join(conversationId);
    cb?.({ ok: true });
  });

  socket.on('send_message', async (data, cb) => {
    const { roomId, ciphertext, iv, tag, text } = data || {};
    if (!roomId) return cb?.({ ok: false, err: 'roomId required' });

    const payload = {
      fromUserId: socket.user.id,
      fromEmail: socket.user.email,
      roomId,
      ciphertext,
      iv,
      tag,
      text,
      ts: new Date()
    };

    // persist the message (ciphertext only to DB)
    try {
      const doc = await Message.create({
        conversationId: roomId,
        fromUserId: socket.user.id,
        fromEmail: socket.user.email,
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        tag: payload.tag,
        ts: payload.ts
      });

      // IMPORTANT: emit to the roomId (was previously using undefined variable)
      io.to(roomId).emit('message', {
        ...payload,
        _id: doc._id
      });

      return cb?.({ ok: true, id: doc._id });
    } catch (err) {
      console.error('save failed', err);
      return cb?.({ ok: false, err: 'save_failed' });
    }
  });

  socket.on('disconnect', () => {
    console.log('socket disconnect', socket.user?.email, socket.id);
  });
});

// ---- DB connection + server start ----
const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

async function startServer() {
  if (!mongoUri) {
    console.warn('MONGO_URI not set. Starting server WITHOUT DB (dev). Set MONGO_URI in .env to enable DB.');
    server.listen(PORT, () => console.log('Server running without DB on', PORT));
    return;
  }

  try {
    // Connect with recommended options (Mongoose v6+ manages options internally)
    await mongoose.connect(mongoUri);
    console.log('Mongo connected');
    server.listen(PORT, () => console.log('Server listening', PORT));
  } catch (err) {
    console.error('Mongo connect failed', err);
    // In dev you may want the server to continue running; choose behavior you prefer.
    // Here we start server without DB so sockets still work (but message persistence will fail).
    server.listen(PORT, () => console.log('Server running WITHOUT DB on', PORT));
  }
}

startServer();
