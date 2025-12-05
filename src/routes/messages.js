// server/src/routes/messages.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth'); // small helper below

// GET /api/messages?conversationId=room1&limit=50&before=<isoDate>
router.get('/', requireAuth, async (req, res) => {
  try {
    const { conversationId, limit = 50, before } = req.query;
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

    const q = { conversationId };
    if (before) q.ts = { $lt: new Date(before) };

    const docs = await Message.find(q)
      .sort({ ts: -1 })
      .limit(parseInt(limit, 10))
      .lean();
      console.log('DEBUG history fetch -> conversationId:', conversationId, 'count:', docs.length, 'sample:', {
      ciphertext_sample: (docs[0]?.ciphertext || '').slice(0,24),
      iv_sample: (docs[0]?.iv || '').slice(0,24),
    });

    // return in chronological order (oldest -> newest)
    return res.json(docs.reverse());
  } catch (err) {
    console.error('history error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
