// src/middleware/auth.js
// JWT-based authentication middleware (Clerk removed)

const jwt = require('jsonwebtoken');

/**
 * Verify JWT and return { userId, email }.
 * @param {string} token
 */
function authenticateToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('missing_token');
    err.code = 'missing_token';
    throw err;
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET);

  if (!payload || !payload.userId || !payload.email) {
    const err = new Error('invalid_token');
    err.code = 'invalid_token';
    throw err;
  }

  return {
    userId: String(payload.userId),
    email: String(payload.email).toLowerCase().trim(),
  };
}

/**
 * Express middleware for REST APIs.
 * - Extracts Bearer token
 * - Verifies with JWT_SECRET
 * - Attaches req.user = { userId, email }
 */
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'unauthenticated',
        message: 'Authorization header required',
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'unauthenticated',
        message: 'Authorization header must be "Bearer <token>"',
      });
    }

    const token = parts[1];
    const user = authenticateToken(token);

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'unauthenticated',
      message: 'Token verification failed',
    });
  }
}

module.exports = { requireAuth, authenticateToken };


