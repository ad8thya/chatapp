// src/routes/conversations.js
const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// If your project already has an auth middleware, use that. Replace the line below
// with your real middleware import if needed:
// const { requireAuth } = require('../middleware/auth');
//
// If you don't have requireAuth, this dummy passthrough will allow requests in dev.
// REMOVE in production and replace with your real auth middleware.
const requireAuth = (req, res, next) => {
  if (req.user) return next();
  // if you use JWT auth, your server probably populates req.user earlier.
  // for quick dev: try to read user id from a header (not recommended for prod)
  if (req.headers['x-dev-user']) {
    req.user = { id: req.headers['x-dev-user'] };
    return next();
  }
  return res.status(401).json({ error: 'unauthenticated' });
};

// POST /api/conversations  { title, participantEmails: [ 'a@b.com' ] }
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, participantEmails = [] } = req.body;
    // Find user IDs for the provided emails
    const users = await User.find({ email: { $in: participantEmails } });
    const userIds = users.map(u => u._id.toString());

    // ensure the creator is included
    if (!userIds.includes(req.user.id)) userIds.push(req.user.id);

    const convo = await Conversation.create({
      title,
      participants: userIds,
      createdBy: req.user.id
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
