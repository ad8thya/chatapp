// src/routes/messages.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');

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

    const safeDocs = docs.map(d => ({
      ...d,
      ciphertext: d.ciphertext == null ? '' : String(d.ciphertext),
      iv: d.iv == null ? '' : String(d.iv),
      tag: d.tag == null ? '' : String(d.tag)
    }));

    console.log('DEBUG history fetch -> conversationId:', conversationId, 'count:', safeDocs.length);
    return res.json(safeDocs.reverse());
  } catch (err) {
    console.error('history error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
