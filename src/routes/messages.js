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
      tag: d.tag == null ? '' : String(d.tag),
      status: d.status || 'sent'
    }));

    console.log('DEBUG history fetch -> conversationId:', conversationId, 'count:', safeDocs.length);
    return res.json(safeDocs.reverse());
  } catch (err) {
    console.error('history error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/messages/:id/status
router.post('/:id/status', requireAuth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { status } = req.body; // expected 'delivered' or 'read'

    if (!['delivered', 'read'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'not_found' });

    // Make status monotonic: sent -> delivered -> read
    const order = { sent: 0, delivered: 1, read: 2 };
    if (order[status] <= order[msg.status]) {
      return res.json({ ok: true, status: msg.status });
    }

    msg.status = status;
    await msg.save();

    // Emit status change to room via io
    const io = req.app.get('io');
    if (io) {
      io.to(String(msg.conversationId)).emit('message_status', {
        messageId: msg._id.toString(),
        status: msg.status,
        conversationId: msg.conversationId
      });
    }

    return res.json({ ok: true, status: msg.status });
  } catch (err) {
    console.error('status update err', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
