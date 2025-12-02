require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const { verifyToken } = require('./utils/jwt');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);

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

  socket.on('join_conversation', (roomId, cb) => {
    socket.join(roomId);
    cb?.({ ok: true });
  });

  socket.on('send_message', async (data, cb) => {
    // accept ciphertext payload or legacy text
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
      ts: new Date().toISOString()
    };
    // emit to room
    io.to(roomId).emit('message', payload);
    return cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    console.log('socket disconnect', socket.user?.email, socket.id);
  });
});

// Connect DB and start
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    server.listen(PORT, () => console.log('Server listening on', PORT));
  })
  .catch(err => {
    console.error('Mongo connect failed', err);
    server.listen(PORT, () => console.log('Server running without DB on', PORT));
  });
