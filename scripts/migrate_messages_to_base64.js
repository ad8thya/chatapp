// scripts/migrate_messages_to_base64.js
// Optional one-time migration script to convert old DB records with Buffer/Array ciphertext/iv/tag
// to proper base64 string format. Run manually: node scripts/migrate_messages_to_base64.js
// This script should NOT be executed by Cursor; just add it to the repo for manual use if needed.

require('dotenv').config();
const mongoose = require('mongoose');

// Same helper as in routes/messages.js
function toBase64String(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (Buffer.isBuffer(val)) return val.toString('base64');
  if (val && Array.isArray(val.data)) return Buffer.from(val.data).toString('base64');
  if (Array.isArray(val)) return Buffer.from(val).toString('base64');
  return String(val);
}

async function migrate() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const Message = mongoose.model('Message', new mongoose.Schema({}, { strict: false }), 'messages');

    // Find all messages
    const messages = await Message.find({}).lean();
    console.log(`Found ${messages.length} messages to check`);

    let updated = 0;
    let skipped = 0;

    for (const msg of messages) {
      const needsUpdate = 
        (msg.ciphertext != null && typeof msg.ciphertext !== 'string') ||
        (msg.iv != null && typeof msg.iv !== 'string') ||
        (msg.tag != null && typeof msg.tag !== 'string');

      if (!needsUpdate) {
        skipped++;
        continue;
      }

      const updates = {};
      if (msg.ciphertext != null && typeof msg.ciphertext !== 'string') {
        updates.ciphertext = toBase64String(msg.ciphertext);
      }
      if (msg.iv != null && typeof msg.iv !== 'string') {
        updates.iv = toBase64String(msg.iv);
      }
      if (msg.tag != null && typeof msg.tag !== 'string') {
        updates.tag = toBase64String(msg.tag);
      }

      await Message.updateOne({ _id: msg._id }, { $set: updates });
      updated++;
    }

    console.log(`Migration complete: ${updated} updated, ${skipped} skipped (already strings)`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrate();

