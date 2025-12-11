// src/routes/auth.js
// Auth routes with email verification workflow
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const { sendVerificationEmail } = require('../utils/mailer');

// POST /api/auth/register
// Creates user with emailVerified=false and sends verification email
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'email exists' });
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Generate verification token (32 random bytes as hex)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hour expiry
    
    const user = await User.create({
      email,
      passwordHash,
      displayName,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    });
    
    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (mailError) {
      console.error('Failed to send verification email:', mailError);
      // Continue anyway - user can request resend later
    }
    
    return res.json({
      user: { id: user._id, email: user.email, displayName, emailVerified: false },
      message: 'Registration successful. Please check your email to verify your account.'
    });
  } catch (e) {
    console.error('Register error:', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// GET /api/auth/verify-email?token=...
// Verifies email using token from email link
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token required' });
    
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    // Return success - client can redirect to login
    return res.json({ message: 'Email verified successfully. You can now login.' });
  } catch (e) {
    console.error('Verify email error:', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// POST /api/auth/login
// Requires emailVerified=true
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });
    
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    
    // Check email verification
    if (!user.emailVerified) {
      return res.status(401).json({ 
        error: 'email_not_verified',
        message: 'Please verify your email before logging in. Check your inbox for the verification link.'
      });
    }
    
    // Sign JWT with 2h expiry for access token
    const token = signToken({ id: user._id, email: user.email }, { expiresIn: '2h' });
    
    return res.json({
      user: { id: user._id, email: user.email, displayName: user.displayName },
      token
    });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
