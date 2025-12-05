// src/routes/conversations.js
const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Use the real auth middleware that verifies Authorization: Bearer <token>
const { requireAuth } = require('../middleware/auth');

// POST /api/conversations  { title, participantEmails: [ 'a@b.com' ] }
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, participantEmails = [] } = req.body;
    // Find user IDs for the provided emails
    const users = await User.find({ email: { $in: participantEmails } });
    const userIds = users.map(u => u._id.toString());

    // ensure the creator is included
    if (!userIds.includes(String(req.user.id))) userIds.push(String(req.user.id));

    const convo = await Conversation.create({
      title,
      participants: userIds,
      createdBy: String(req.user.id)
    });

    return res.json(convo);
  } catch (err) {
    console.error('create conversation err', err);
    return res.status(500).json({ error: 'create_failed' });
  }
});

// GET /api/conversations
router.get('/', requireAuth, async (req, res) => {
  try {
    const convos = await Conversation.find({ participants: req.user.id }).sort({ createdAt: -1 });
    return res.json(convos);
  } catch (err) {
    console.error('list conversations err', err);
    return res.status(500).json({ error: 'list_failed' });
  }
});

// GET /api/conversations/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: 'not_found' });
    if (!convo.participants.map(String).includes(String(req.user.id))) {
      return res.status(403).json({ error: 'forbidden' });
    }
    return res.json(convo);
  } catch (err) {
    console.error('fetch conversation err', err);
    return res.status(500).json({ error: 'fetch_failed' });
  }
});

module.exports = router;
