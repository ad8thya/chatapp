// server/src/routes/conversations.js
const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation'); // ensure this model exists
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth'); // use your auth middleware

// Create a conversation
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, participantEmails = [] } = req.body;
    const users = await User.find({ email: { $in: participantEmails } });
    const userIds = users.map(u => u._id.toString());
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

// List conversations for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const convos = await Conversation.find({ participants: req.user.id }).sort({ createdAt: -1 });
    return res.json(convos);
  } catch (err) {
    console.error('list conversations err', err);
    return res.status(500).json({ error: 'list_failed' });
  }
});

module.exports = router;
