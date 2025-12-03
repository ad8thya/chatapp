// server/src/middleware/auth.js
const { verifyToken } = require('../utils/jwt');

exports.requireAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'missing auth header' });
  const token = auth.split(' ')[1];
  try {
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
};
