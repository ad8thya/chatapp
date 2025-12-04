const mongoose = require('mongoose');
const S = mongoose.Schema;

// A conversation is basically a chat thread.
// It has a title, list of participants, who created it, and when.
const ConversationSchema = new S({
  title: { type: String, required: true },

  // Each participant is a userId.
  // This allows multi-user chats later (group chat).
  participants: [{ type: S.Types.ObjectId, ref: 'User' }],

  createdBy: { type: S.Types.ObjectId, ref: 'User', required: true },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', ConversationSchema);
