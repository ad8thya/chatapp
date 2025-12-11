// src/models/Conversation.js
const mongoose = require('mongoose');
const S = mongoose.Schema;

const ConversationSchema = new S({
  title: String,
  participants: [{ type: S.Types.ObjectId, ref: 'User' }],
  createdBy: { type: S.Types.ObjectId, ref: 'User' },
  chatKey: { type: String }, // base64 of 32 bytes, server-generated
  keyVersion: { type: Number, default: 0 }, // Track key rotations
  keyRotatedAt: Date,
  keyRotatedBy: { type: S.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Conversation', ConversationSchema);
