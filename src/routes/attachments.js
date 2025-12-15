const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');

// memory storage (no local files saved)
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const result = await cloudinary.uploader.upload_stream(
        {
          folder: 'chat-attachments',
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return res.status(500).json({ error: 'upload_failed' });
          }

          return res.json({
            url: result.secure_url,
            publicId: result.public_id,
            filename: req.file.originalname,
            mime: req.file.mimetype,
            size: req.file.size,
          });
        }
      );

      result.end(req.file.buffer);
    } catch (err) {
      console.error('Attachment upload error:', err);
      res.status(500).json({ error: 'server_error' });
    }
  }
);

module.exports = router;



