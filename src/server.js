require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const Message = require('./models/Message'); // require at top
const authRoutes = require('./routes/auth');
const { verifyToken } = require('./utils/jwt');
// server.js (or src/server.js)
const convRoutes = require('./routes/conversations');



const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api/conversations', require('./routes/conversations'));
app.use(cookieParser());
app.use('/api/messages', require('./routes/messages'));
app.use('/api/auth', authRoutes);
app.use('/api/conversations', require('./routes/conversations'));

// HTTP server
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

// JWT auth for sockets: expects token in handshake auth: { token }
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Auth error: token required'));
  try {
    const payload = verifyToken(token);
    socket.user = payload; // { id, email }
    return next();
  } catch (err) {
    return next(new Error('Auth error: invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('socket connected user:', socket.user?.email, socket.id);

  socket.on('join_conversation', (conversationId, cb) => {
  socket.join(conversationId);
  cb?.({ ok: true });
});

  socket.on('send_message', async (data, cb) => {
  const { roomId, ciphertext, iv, tag, text } = data || {};
  if (!roomId) return cb?.({ ok:false, err:'roomId required' });

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

  // persist ciphertext only
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
    // emit saved doc (or payload) to room
    io.to(conversationId).emit('message', {
      ...payload,
      _id: doc._id
    });
    return cb?.({ ok:true, id: doc._id });
  } catch (err) {
    console.error('save failed', err);
    return cb?.({ ok:false, err:'save_failed' });
  }
});

  socket.on('disconnect', () => {
    console.log('socket disconnect', socket.user?.email, socket.id);
  });
});

// Connect DB and start
const PORT = process.env.PORT || 3000;
// connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Mongo connected');
    server.listen(process.env.PORT || 3000, () => console.log('Server listening', process.env.PORT || 3000));
  })
  .catch(err => {
    console.error('Mongo connect failed', err);
    // keep server running for development, or exit if you prefer
    server.listen(process.env.PORT || 3000, () => console.log('Server running without DB on', process.env.PORT || 3000));
  });

