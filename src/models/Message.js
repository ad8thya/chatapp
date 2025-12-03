const mongoose = require('mongoose');
const S = mongoose.Schema;

const MessageSchema = new S({
  conversationId: { type: String, required: true },
  fromUserId: { type: S.Types.ObjectId, ref: 'User' },
  fromEmail: String,
  ciphertext: String,
  iv: String,
  tag: String,
  ts: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent','delivered','read'], default: 'sent' }
});

module.exports = mongoose.model('Message', MessageSchema);
