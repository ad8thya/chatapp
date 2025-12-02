const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

exports.signToken = (payload, opts = { expiresIn: '1h' }) =>
  jwt.sign(payload, JWT_SECRET, opts);

exports.verifyToken = (token) => jwt.verify(token, JWT_SECRET);
