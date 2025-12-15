// src/models/User.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  clerkId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, index: true },
  displayName: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
