// src/middleware/auth.js
// Small auth middleware that uses your utils/jwt.verifyToken helper
// or falls back to jsonwebtoken.verify if needed.

const { verifyToken } = require('../utils/jwt'); // preferred: centralised verify logic
// fallback: if utils/jwt not present you can uncomment the next line
// const jwt = require('jsonwebtoken');

module.exports.requireAuth = (req, res, next) => {
  // DEBUG: show incoming header (helps verify the client actually sent it)
  console.log('DEBUG incoming auth header ->', req.headers['authorization']);

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return res.status(401).json({ error: 'unauthenticated' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('DEBUG bad auth format', parts);
    return res.status(401).json({ error: 'unauthenticated' });
  }

  const token = parts[1];
  try {
    // Use centralized verification so signing secret / checks are consistent
    const payload = verifyToken(token); // expect throws on invalid/expired
    req.user = { id: payload.id, email: payload.email };
    return next();
  } catch (e) {
    console.log('JWT VERIFY FAILED:', e && e.message);
    return res.status(401).json({ error: 'unauthenticated' });
  }
};
