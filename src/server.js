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
const attachmentsRoutes = require('./routes/attachments');
const keyRotationRoutes = require('./routes/keyrotation');

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
app.use('/api/attachments', attachmentsRoutes);

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
      const { roomId, ciphertext, iv, tag, text, attachments } = data || {};
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

      const doc = await Message.create({
        conversationId: roomId,
        fromUserId: socket.user.id,
        fromEmail: socket.user.email,
        ciphertext: cText,
        iv: ivText,
        tag: tagText,
        ts: new Date(),
        status: 'sent',
        attachments: attachments || []
      });

      // Emit exactly once to room
      const messagePayload = {
        _id: doc._id,
        conversationId: roomId,
        fromUserId: socket.user.id,
        fromEmail: socket.user.email,
        ciphertext: cText,
        iv: ivText,
        tag: tagText,
        ts: doc.ts,
        status: 'sent',
        attachments: doc.attachments || []
      };

      io.to(roomId).emit('message', messagePayload);

      // Auto-mark as delivered for all participants in room (except sender)
      socket.to(roomId).emit('message_status', {
        messageId: doc._id,
        status: 'delivered',
        conversationId: roomId
      });

      return cb?.({ ok: true, id: doc._id });
    } catch (err) {
      console.error('save failed', err);
      return cb?.({ ok: false, err: 'save_failed' });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { conversationId } = data || {};
    if (!conversationId) return;
    
    // Broadcast to room (except sender)
    socket.to(conversationId).emit('user_typing', {
      userId: socket.user.id,
      email: socket.user.email,
      conversationId
    });
  });

  socket.on('stop_typing', (data) => {
    const { conversationId } = data || {};
    if (!conversationId) return;
    
    socket.to(conversationId).emit('user_stopped_typing', {
      userId: socket.user.id,
      email: socket.user.email,
      conversationId
    });
  });

  // Presence: user online
  socket.on('presence:online', () => {
    // Broadcast to all rooms user is in
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.to(room).emit('presence:update', {
          userId: socket.user.id,
          email: socket.user.email,
          status: 'online',
          conversationId: room
        });
      }
    });
  });

  // Message status update (delivered/read)
  socket.on('message_status_update', async (data) => {
    try {
      const { messageId, status } = data || {};
      if (!messageId || !['delivered', 'read'].includes(status)) {
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) return;

      // Update status in DB
      message.status = status;
      await message.save();

      // Broadcast status update to conversation room
      io.to(String(message.conversationId)).emit('message_status', {
        messageId: message._id,
        status: status,
        conversationId: message.conversationId
      });
    } catch (err) {
      console.error('Message status update error:', err);
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

  // Disconnect handler - broadcast offline status
  socket.on('disconnect', (reason) => {
    console.log('✗ Socket disconnected:', socket.user?.email, socket.id, 'reason:', reason);
    
    // Broadcast offline status to all rooms
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.to(room).emit('presence:update', {
          userId: socket.user.id,
          email: socket.user.email,
          status: 'offline',
          conversationId: room
        });
      }
    });
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