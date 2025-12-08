// src/server.js
require('dotenv').config(); // must be first so process.env is populated

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Models & routes
const Message = require('./models/Message');
const authRoutes = require('./routes/auth');
const conversationsRoutes = require('./routes/conversations');
const messagesRoutes = require('./routes/messages');

const { verifyToken } = require('./utils/jwt'); // used for socket auth

const app = express();

// ---- Middleware (order matters) ----
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

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
      // Coerce to plain strings and trim. This avoids Buffer/object values being saved.
      const cText = ciphertext == null ? '' : String(ciphertext).trim();
      const ivText = iv == null ? '' : String(iv).trim();
      const tagText = tag == null ? '' : String(tag).trim();
      const textText = text == null ? '' : String(text);

      if (!cText || !ivText) {
        console.warn('send_message missing ciphertext/iv from', socket.user?.email);
        return cb?.({ ok: false, err: 'ciphertext_or_iv_missing' });
      }

      console.log('DEBUG socket send_message received ->', {
        from: socket.user?.email,
        roomId,
        ciphertext_sample: cText.slice(0, 24),
        iv_sample: ivText.slice(0, 24),
        ciphertext_len: cText.length,
        iv_len: ivText.length
      });

      const doc = await Message.create({
        conversationId: roomId,
        fromUserId: socket.user.id,
        fromEmail: socket.user.email,
        ciphertext: cText,
        iv: ivText,
        tag: tagText,
        ts: payload.ts
      });

      console.log('DEBUG message saved -> id:', doc._id.toString(), 'emit ciphertext_len:', (doc.ciphertext || '').length, 'iv_len:', (doc.iv || '').length);

      // Emit the exact strings we saved
      io.to(roomId).emit('message', {
        _id: doc._id,
        conversationId: roomId,
        fromUserId: socket.user.id,
        fromEmail: socket.user.email,
        ciphertext: cText,
        iv: ivText,
        tag: tagText,
        ts: payload.ts
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
    await mongoose.connect(mongoUri);
    console.log('Mongo connected');
    server.listen(PORT, () => console.log('Server listening', PORT));
  } catch (err) {
    console.error('Mongo connect failed', err);
    server.listen(PORT, () => console.log('Server running WITHOUT DB on', PORT));
  }
}

startServer();
