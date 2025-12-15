// src/middleware/auth.js
const { authenticateRequest } = require('@clerk/backend');

module.exports.requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'unauthenticated' });
    }

    const token = authHeader.replace('Bearer ', '');

    const auth = await authenticateRequest({
      token,
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!auth || !auth.userId) {
      return res.status(401).json({ error: 'unauthenticated' });
    }

    const email =
      auth.sessionClaims?.email ||
      auth.sessionClaims?.primary_email ||
      auth.sessionClaims?.email_address;

    if (!email) {
      console.error('JWT claims:', auth.sessionClaims);
      return res.status(400).json({ error: 'user_email_required' });
    }

    req.user = {
      clerkId: auth.userId,
      email,
    };

    next();
  } catch (err) {
    console.error('Clerk auth error:', err);
    return res.status(401).json({ error: 'unauthenticated' });
  }
};
