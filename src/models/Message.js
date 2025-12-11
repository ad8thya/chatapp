// src/models/Message.js
const mongoose = require('mongoose');
const S = mongoose.Schema;

const AttachmentSchema = new S({
  url: { type: String, required: true },
  filename: String,
  mime: String,
  size: Number, // bytes
}, { _id: false });

const MessageSchema = new S({
  conversationId: { type: S.Types.ObjectId, ref: 'Conversation', required: true },
  fromUserId: { type: S.Types.ObjectId, ref: 'User' },
  fromEmail: String,
  ciphertext: String,
  iv: String,
  tag: String,
  ts: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent','delivered','read'], default: 'sent' },
  attachments: [AttachmentSchema] // Array of attachment metadata
});

module.exports = mongoose.model('Message', MessageSchema);
