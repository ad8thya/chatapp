// server/src/middleware/auth.js
const { verifyToken } = require('../utils/jwt');

module.exports.requireAuth = (req, res, next) => {
  console.log('DEBUG incoming auth header ->', req.headers['authorization']);

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return res.status(401).json({ error: 'unauthenticated' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    console.log('DEBUG bad auth format', parts);
    return res.status(401).json({ error: 'unauthenticated' });
  }

  const scheme = parts[0];
  const token = parts[1];

  // If Bearer and looks like our app token, try verifyToken
  try {
    const payload = verifyToken(token); // throws if invalid
    req.user = { id: payload.id, email: payload.email };
    return next();
  } catch (e) {
    // Not our app JWT. You may send a Clerk token directly
    console.log('JWT VERIFY FAILED:', e && e.message);
    // If you want to accept Clerk tokens directly, implement validateClerkToken here
    // For now we reject; the /api/auth/clerk exchange route is the recommended path.
    return res.status(401).json({ error: 'unauthenticated' });
  }
};
