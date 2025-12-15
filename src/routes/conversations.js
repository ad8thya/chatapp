// src/routes/conversations.js
const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { getOrCreateUser } = require('../utils/userHelper');

// Helper: generate base64 key of 32 raw bytes
function genBase64Key32() {
  return Buffer.from(crypto.randomBytes(32)).toString('base64'); // 44 chars including padding
}

// POST /api/conversations  { title, participantEmails: [ 'a@b.com' ] }
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, participantEmails = [] } = req.body;
    
    // Get or create current user's MongoDB record
    const currentUser = await getOrCreateUser(req.user.clerkId, req.user.email);
    
    // Find existing users by email
    const users = await User.find({ email: { $in: participantEmails } });
    const userIds = users.map(u => u._id);
    
    // Add current user to participants if not already included
    if (!userIds.some(id => id.toString() === currentUser._id.toString())) {
      userIds.push(currentUser._id);
    }

    const chatKey = genBase64Key32();
    const convo = await Conversation.create({
      title,
      participants: userIds,
      createdBy: currentUser._id,
      chatKey
    });

    // return conversation including chatKey to the creator (participants will fetch via separate endpoint)
    return res.json(convo);
  } catch (err) {
    console.error('create conversation err', err);
    return res.status(500).json({ error: 'create_failed' });
  }
});

// GET /api/conversations
router.get('/', requireAuth, async (req, res) => {
  try {
    // Get or create current user's MongoDB record
    const currentUser = await getOrCreateUser(req.user.clerkId, req.user.email);
    
    // Find conversations where current user is a participant
    const convos = await Conversation.find({ participants: currentUser._id }).sort({ createdAt: -1 });
    return res.json(convos);
  } catch (err) {
    console.error('list conversations err', err);
    return res.status(500).json({ error: 'list_failed' });
  }
});

// GET /api/conversations/:id/key  -> { chatKey } (must come before /:id to avoid route conflict)
router.get('/:id/key', requireAuth, async (req, res) => {
  try {
    // Get or create current user's MongoDB record
    const currentUser = await getOrCreateUser(req.user.clerkId, req.user.email);
    
    const convo = await Conversation.findById(req.params.id).lean();
    if (!convo) return res.status(404).json({ error: 'not_found' });
    if (!convo.participants.map(String).includes(String(currentUser._id))) {
      return res.status(403).json({ error: 'forbidden' });
    }
    // Return the chatKey (server-trusted single source)
    return res.json({ chatKey: convo.chatKey });
  } catch (err) {
    console.error('fetch convo key err', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/conversations/:id/rotate-key
// Rotates conversation encryption key (creator only)
router.post('/:id/rotate-key', requireAuth, async (req, res) => {
  try {
    // Get or create current user's MongoDB record
    const currentUser = await getOrCreateUser(req.user.clerkId, req.user.email);
    
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ error: 'conversation_not_found' });
    }

    // Only creator can rotate key
    if (String(conversation.createdBy) !== String(currentUser._id)) {
      return res.status(403).json({ error: 'only_creator_can_rotate_key' });
    }

    // Check if user is participant
    const isParticipant = conversation.participants
      .map(String)
      .includes(String(currentUser._id));
    
    if (!isParticipant) {
      return res.status(403).json({ error: 'not_participant' });
    }

    // Generate new 32-byte key (base64)
    const newKey = genBase64Key32();

    // Store new key
    conversation.chatKey = newKey;
    conversation.keyVersion = (conversation.keyVersion || 0) + 1;
    conversation.keyRotatedAt = new Date();
    conversation.keyRotatedBy = currentUser._id;
    await conversation.save();

    console.log(`✓ Key rotated for conversation ${id} by ${req.user.email}`);

    return res.json({
      chatKey: newKey,
      keyVersion: conversation.keyVersion,
      rotatedAt: conversation.keyRotatedAt,
      message: 'Key rotated successfully. Participants should fetch new key.'
    });
  } catch (err) {
    console.error('Key rotation error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Get or create current user's MongoDB record
    const currentUser = await getOrCreateUser(req.user.clerkId, req.user.email);
    
    const id = req.params.id;
    const Message = require('../models/Message');
    const convo = await Conversation.findById(id);
    
    if (!convo) return res.status(404).json({ error: 'not_found' });

    // Only allow participants to delete
    if (!convo.participants.map(String).includes(String(currentUser._id))) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // Hard delete messages + conversation
    await Message.deleteMany({ conversationId: id });
    await Conversation.findByIdAndDelete(id);

    // Notify room that it was deleted (if io is available)
    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('conversation_deleted', { conversationId: id });
    }

    return res.json({ ok: true, id });
  } catch (err) {
    console.error('delete conversation err', err);
    return res.status(500).json({ error: 'delete_failed' });
  }
});

// GET /api/conversations/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    // Get or create current user's MongoDB record
    const currentUser = await getOrCreateUser(req.user.clerkId, req.user.email);
    
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: 'not_found' });
    if (!convo.participants.map(String).includes(String(currentUser._id))) {
      return res.status(403).json({ error: 'forbidden' });
    }
    return res.json(convo);
  } catch (err) {
    console.error('fetch conversation err', err);
    return res.status(500).json({ error: 'fetch_failed' });
  }
});

module.exports = router;
