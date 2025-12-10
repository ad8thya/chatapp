// src/server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const Message = require('./models/Message');
const authRoutes = require('./routes/auth');
const conversationsRoutes = require('./routes/conversations');
const messagesRoutes = require('./routes/messages');

const { verifyToken } = require('./utils/jwt');

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/conversations', conversationsRoutes);

// HTTP + Socket servers
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

// Socket auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.log('Socket connection rejected: no token');
    return next(new Error('Auth error: token required'));
  }
  try {
    const payload = verifyToken(token);
    socket.user = payload;
    console.log('Socket authenticated:', payload.email);
    return next();
  } catch (err) {
    console.log('Socket auth failed:', err.message);
    return next(new Error('Auth error: invalid token'));
  }
});

// Socket connection handler
io.on('connection', (socket) => {
  console.log('✓ Socket connected:', socket.user?.email, socket.id);

  // Join conversation room
  socket.on('join_conversation', (conversationId, cb) => {
    socket.join(conversationId);
    console.log(`✓ User ${socket.user?.email} joined conversation ${conversationId}`);
    cb?.({ ok: true });
  });

  // Send message handler
  socket.on('send_message', async (data, cb) => {
    try {
      const { roomId, ciphertext, iv, tag, text } = data || {};
      if (!roomId) return cb?.({ ok: false, err: 'roomId required' });

      // Coerce to plain strings
      const cText = ciphertext == null ? '' : String(ciphertext);
      const ivText = iv == null ? '' : String(iv);
      const tagText = tag == null ? '' : String(tag);
      const textText = text == null ? '' : String(text);

      if (!cText || !ivText) {
        console.warn('send_message missing ciphertext/iv from', socket.user?.email);
        return cb?.({ ok: false, err: 'ciphertext_or_iv_missing' });
      }

      const payload = {
        fromUserId: socket.user.id,
        fromEmail: socket.user.email,
        roomId,
        ciphertext: cText,
        iv: ivText,
        tag: tagText,
        text: textText,
        ts: new Date()
      };

      const doc = await Message.create({
        conversationId: roomId,
        fromUserId: socket.user.id,
        fromEmail: socket.user.email,
        ciphertext: cText,
        iv: ivText,
        tag: tagText,
        ts: payload.ts
      });

      // Emit exactly once
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

  // Leave conversation
  socket.on('leave_conversation', (conversationId, cb) => {
    socket.leave(conversationId);
    console.log(`✓ User ${socket.user?.email} left conversation ${conversationId}`);
    cb?.({ ok: true });
  });

  // List user's rooms
  socket.on('list_my_rooms', (cb) => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    cb?.({ rooms });
  });

  // Disconnect handler
  socket.on('disconnect', (reason) => {
    console.log('✗ Socket disconnected:', socket.user?.email, socket.id, 'reason:', reason);
  });
});

// DB connection + server start
const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

async function startServer() {
  if (!mongoUri) {
    console.warn('⚠ MONGO_URI not set. Starting server WITHOUT DB (dev mode).');
    server.listen(PORT, () => {
      console.log('================================================');
      console.log(`Server running WITHOUT DB on port ${PORT}`);
      console.log('================================================');
    });
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('✓ MongoDB connected');
    server.listen(PORT, () => {
      console.log('================================================');
      console.log(`✓ Server listening on port ${PORT}`);
      console.log('✓ Database connected');
      console.log('================================================');
    });
  } catch (err) {
    console.error('✗ MongoDB connect failed:', err.message);
    server.listen(PORT, () => {
      console.log('================================================');
      console.log(`Server running WITHOUT DB on port ${PORT}`);
      console.log('================================================');
    });
  }
}

startServer();