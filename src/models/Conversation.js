// src/models/Conversation.js
const mongoose = require('mongoose');
const S = mongoose.Schema;

const ConversationSchema = new S({
  title: { type: String, required: true },
  participants: [{ type: S.Types.ObjectId, ref: 'User' }],
  createdBy: { type: S.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', ConversationSchema);
