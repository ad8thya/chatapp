// server/src/models/Conversation.js
const mongoose = require('mongoose');
const S = mongoose.Schema;

const ConversationSchema = new S({
  title: String,
  participants: [{ type: S.Types.ObjectId, ref: 'User' }],
  createdBy: { type: S.Types.ObjectId, ref: 'User' },
  chatKey: { type: String }, // base64 of 32 bytes, server-generated
}, { timestamps: true });

module.exports = mongoose.model('Conversation', ConversationSchema);
