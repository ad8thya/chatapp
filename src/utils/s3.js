// src/utils/s3.js
// S3 signed URL helper with local fallback for dev
// For production: configure AWS credentials in .env
// For dev: falls back to local file storage

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let s3Client = null;
const USE_S3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET;
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Initialize S3 client if credentials available
if (USE_S3) {
  s3Client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log('✓ S3 configured:', process.env.S3_BUCKET);
} else {
  // Ensure uploads directory exists for local fallback
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  console.log('⚠ S3 not configured, using local file storage:', UPLOAD_DIR);
}

/**
 * Generate signed upload URL
 * Returns { uploadUrl, publicUrl, fileId }
 */
async function getSignedUploadUrl(filename, contentType, conversationId) {
  const fileId = crypto.randomBytes(16).toString('hex');
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `conversations/${conversationId}/${fileId}-${sanitizedFilename}`;

  if (USE_S3 && s3Client) {
    // S3 signed URL
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min
    const publicUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl, fileId };
  } else {
    // Local fallback: return endpoint that accepts PUT
    const publicUrl = `/api/attachments/${fileId}`;
    return {
      uploadUrl: `/api/attachments/upload/${fileId}?filename=${encodeURIComponent(sanitizedFilename)}&contentType=${encodeURIComponent(contentType)}`,
      publicUrl,
      fileId
    };
  }
}

/**
 * Handle local file upload (dev fallback)
 */
async function handleLocalUpload(fileId, filename, contentType, buffer) {
  const filePath = path.join(UPLOAD_DIR, `${fileId}-${filename}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

module.exports = {
  getSignedUploadUrl,
  handleLocalUpload,
  USE_S3,
  UPLOAD_DIR,
};




