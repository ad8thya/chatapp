// src/routes/attachments.js
// Attachment routes: signed URL generation and local upload handler
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getSignedUploadUrl, handleLocalUpload, USE_S3, UPLOAD_DIR } = require('../utils/s3');
const { requireAuth } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// Configure multer for local uploads (dev fallback)
const upload = multer({ dest: UPLOAD_DIR });

// GET /api/attachments/signed-url
// Generate signed upload URL for client to PUT file directly
router.get('/signed-url', requireAuth, async (req, res) => {
  try {
    const { filename, contentType, conversationId } = req.query;
    
    if (!filename || !contentType || !conversationId) {
      return res.status(400).json({ error: 'filename, contentType, and conversationId required' });
    }

    // Validate file size (max 10MB for MVP)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const size = parseInt(req.query.size || '0');
    if (size > maxSize) {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }

    // Validate content type (basic check)
    const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'text/'];
    const isAllowed = allowedTypes.some(type => contentType.startsWith(type));
    if (!isAllowed) {
      return res.status(400).json({ error: 'File type not allowed' });
    }

    const result = await getSignedUploadUrl(filename, contentType, conversationId);
    return res.json(result);
  } catch (err) {
    console.error('Signed URL error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// PUT /api/attachments/upload/:fileId (local fallback only)
// Handles local file upload when S3 is not configured
router.put('/upload/:fileId', requireAuth, upload.single('file'), async (req, res) => {
  if (USE_S3) {
    return res.status(400).json({ error: 'S3 configured, use signed URL directly' });
  }

  try {
    const { fileId } = req.params;
    const { filename, contentType } = req.query;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Move uploaded file to permanent location
    const finalPath = path.join(UPLOAD_DIR, `${fileId}-${filename}`);
    fs.renameSync(req.file.path, finalPath);

    return res.json({ success: true, fileId });
  } catch (err) {
    console.error('Local upload error:', err);
    return res.status(500).json({ error: 'upload_failed' });
  }
});

// GET /api/attachments/:fileId (local fallback only)
// Serves locally stored files
router.get('/:fileId', (req, res) => {
  if (USE_S3) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const { fileId } = req.params;
    const files = fs.readdirSync(UPLOAD_DIR);
    const file = files.find(f => f.startsWith(fileId + '-'));
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(UPLOAD_DIR, file);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('File serve error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;




