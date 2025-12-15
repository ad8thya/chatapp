// src/server.js
// Express + Socket.IO server with JWT authentication
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { authenticateToken } = require('./middleware/auth');

const Message = require('./models/Message');
const conversationsRoutes = require('./routes/conversations');
const messagesRoutes = require('./routes/messages');
const attachmentsRoutes = require('./routes/attachments');
const authRoutes = require('./routes/auth');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ============================================
// API ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/attachments', attachmentsRoutes);

// ============================================
// HTTP + SOCKET SERVERS
// ============================================
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: true, credentials: true }
});

// Make io available to routes
app.set('io', io);

// ============================================
// SOCKET.IO AUTHENTICATION (matches REST JWT)
// ============================================
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    console.error('[SOCKET] No token provided');
    return next(new Error('No token provided'));
  }

  try {
    const user = authenticateToken(token);
    socket.user = user;
    console.log('[SOCKET] ✓ Authenticated:', socket.user.email);
    return next();
  } catch (err) {
    console.error('[SOCKET] Auth failed:', err.message || err);
    return next(new Error('Authentication failed'));
  }
});

// ============================================
// SOCKET EVENT HANDLERS
// ============================================
io.on('connection', (socket) => {
  console.log('[SOCKET] ✓ Connected:', socket.user?.email, socket.id);

  // Join conversation room
  socket.on('join_conversation', (conversationId, cb) => {
    socket.join(conversationId);
    console.log(`[SOCKET] User ${socket.user?.email} joined ${conversationId}`);
    cb?.({ ok: true });
  });

  // Send message
  socket.on('send_message', async (data, cb) => {
    try {
      const { roomId, ciphertext, iv, tag, attachments } = data || {};
      
      if (!roomId) {
        return cb?.({ ok: false, err: 'roomId required' });
      }

      if (!ciphertext || !iv) {
        console.warn('[SOCKET] Missing ciphertext/iv from', socket.user?.email);
        return cb?.({ ok: false, err: 'ciphertext_or_iv_missing' });
      }

      // Get or create MongoDB user
      const { getOrCreateUser } = require('./utils/userHelper');
      const mongoUser = await getOrCreateUser(socket.user.userId, socket.user.email);

      // Save message
      const doc = await Message.create({
        conversationId: roomId,
        fromUserId: mongoUser._id,
        fromEmail: socket.user.email,
        ciphertext: String(ciphertext),
        iv: String(iv),
        tag: String(tag || ''),
        ts: new Date(),
        status: 'sent',
        attachments: attachments || []
      });

      // Emit to room
      const messagePayload = {
        _id: doc._id,
        conversationId: roomId,
        fromUserId: mongoUser._id.toString(),
        fromEmail: socket.user.email,
        ciphertext: String(ciphertext),
        iv: String(iv),
        tag: String(tag || ''),
        ts: doc.ts,
        status: 'sent',
        attachments: doc.attachments || []
      };

      io.to(roomId).emit('message', messagePayload);

      return cb?.({ ok: true, id: doc._id });
    } catch (err) {
      console.error('[SOCKET] send_message failed:', err);
      return cb?.({ ok: false, err: 'save_failed' });
    }
  });

  // Typing indicators
  socket.on('typing', (data) => {
    const { conversationId } = data || {};
    if (!conversationId) return;
    
    socket.to(conversationId).emit('user_typing', {
      userId: socket.user.userId,
      email: socket.user.email,
      conversationId
    });
  });

  socket.on('stop_typing', (data) => {
    const { conversationId } = data || {};
    if (!conversationId) return;
    
    socket.to(conversationId).emit('user_stopped_typing', {
      userId: socket.user.userId,
      email: socket.user.email,
      conversationId
    });
  });

  // Presence
  socket.on('presence:online', () => {
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.to(room).emit('presence:update', {
          userId: socket.user.userId,
          email: socket.user.email,
          status: 'online',
          conversationId: room
        });
      }
    });
  });

  // Message delivered receipt
  socket.on('message_delivered', async ({ messageId }) => {
    try {
      if (!messageId) return;
      
      const msg = await Message.findById(messageId);
      if (!msg || msg.status !== 'sent') return;
      
      msg.status = 'delivered';
      await msg.save();
      
      io.to(String(msg.conversationId)).emit('message_status', {
        messageId: msg._id.toString(),
        status: 'delivered',
        conversationId: msg.conversationId
      });
    } catch (e) {
      console.error('[SOCKET] message_delivered error:', e);
    }
  });

  // Message read receipt (batch)
  socket.on('message_read', async ({ messageIds, conversationId }) => {
    try {
      if (!Array.isArray(messageIds) || messageIds.length === 0 || !conversationId) return;
      
      await Message.updateMany(
        { 
          _id: { $in: messageIds },
          conversationId: conversationId,
          status: { $ne: 'read' }
        },
        { status: 'read' }
      );
      
      messageIds.forEach(id => {
        io.to(String(conversationId)).emit('message_status', {
          messageId: id.toString(),
          status: 'read',
          conversationId: conversationId
        });
      });
    } catch (e) {
      console.error('[SOCKET] message_read error:', e);
    }
  });

  // Leave conversation
  socket.on('leave_conversation', (conversationId, cb) => {
    socket.leave(conversationId);
    console.log(`[SOCKET] User ${socket.user?.email} left ${conversationId}`);
    cb?.({ ok: true });
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log('[SOCKET] ✗ Disconnected:', socket.user?.email, reason);
    
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.to(room).emit('presence:update', {
          userId: socket.user?.userId,
          email: socket.user?.email,
          status: 'offline',
          conversationId: room
        });
      }
    });
  });
});

// ============================================
// ENVIRONMENT VALIDATION
// ============================================
const REQUIRED_ENV = [
  'JWT_SECRET',
  'MONGO_URI'
];

const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('✗ ERROR: Missing required environment variables:');
  missing.forEach(key => console.error(`   - ${key}`));
  console.error('\nPlease set these in your .env file before starting the server.');
  process.exit(1);
}

// ============================================
// DATABASE CONNECTION & SERVER START
// ============================================
const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI;

async function startServer() {
  try {
    console.log('[DB] Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('[DB] ✓ MongoDB connected');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('[DB] ✗ Connection error:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] ⚠ Disconnected');
    });
    
    // Start server
    server.listen(PORT, () => {
      console.log('========================================');
      console.log(`✓ Server listening on port ${PORT}`);
      console.log('✓ Database connected');
      console.log('✓ JWT authentication enabled');
      console.log('✓ Socket.IO ready');
      console.log('========================================');
    });
    
  } catch (err) {
    console.error('[DB] ✗ MongoDB connection failed:', err.message);
    console.error('\nPlease check:');
    console.error('1. MongoDB is running');
    console.error('2. MONGO_URI is correct in .env');
    console.error('3. Network/firewall allows connection');
    process.exit(1);
  }
}

startServer();