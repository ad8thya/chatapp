const express = require('express');

const router = express.Router();

const Message = require('../models/Message');

const { requireAuth } = require('../middleware/auth');

function toBase64String(val) {

  if (val == null) return '';

  if (typeof val === 'string') return val;

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(val)) return val.toString('base64');

  if (typeof val === 'object') {

    if (Array.isArray(val.data)) {

      try { return Buffer.from(val.data).toString('base64'); } catch(e) {}

    }

    if (Array.isArray(val)) {

      try { return Buffer.from(val).toString('base64'); } catch(e) {}

    }

  }

  return String(val);

}

router.get('/', requireAuth, async (req, res) => {

  try {

    const { conversationId, limit = 50, before } = req.query;

    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

    const q = { conversationId };

    if (before) q.ts = { $lt: new Date(before) };

    const docs = await Message.find(q).sort({ ts: -1 }).limit(parseInt(limit, 10)).lean();

    const safeDocs = docs.map(d => ({

      ...d,

      ciphertext: toBase64String(d.ciphertext),

      iv: toBase64String(d.iv),

      tag: toBase64String(d.tag)

    }));

    if (safeDocs.length) {

      console.log('DEBUG history fetch -> conversationId:', conversationId, 'count:', safeDocs.length, 'cipher_len', safeDocs[0].ciphertext.length, 'iv_len', safeDocs[0].iv.length);

    } else {

      console.log('DEBUG history fetch -> conversationId:', conversationId, 'count:0');

    }

    return res.json(safeDocs.reverse());

  } catch (err) {

    console.error('history error', err);

    return res.status(500).json({ error: 'server_error' });

  }

});

module.exports = router;
