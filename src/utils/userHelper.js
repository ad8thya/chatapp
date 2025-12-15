// src/utils/userHelper.js
// Helper to get or create MongoDB user by Clerk ID

const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Get or create MongoDB user by userId (JWT) and email
 * @param {string} userId - User ID from JWT (Mongo _id as string)
 * @param {string} email - User email from JWT
 * @returns {Promise<Object>} MongoDB user document
 * @throws {Error} If MongoDB is not connected or operation fails
 */
async function getOrCreateUser(userId, email) {
  if (!userId || !email) {
    throw new Error('userId and email are required');
  }

  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB is not connected. Please check your MONGO_URI and ensure MongoDB is running.');
  }

  try {
    // First try to find by _id if provided
    let user = await User.findById(userId);

    if (!user) {
      // Fallback: find by email (unique) to avoid duplicates
      user = await User.findOne({ email });
    }

    if (!user) {
      // Create user record if it doesn't exist
      user = await User.create({
        _id: userId,
        email,
      });
    } else if (user.email !== email) {
      // Update email if it changed
      user.email = email;
      await user.save();
    }

    return user;
  } catch (error) {
    throw error;
  }
}

module.exports = { getOrCreateUser };

