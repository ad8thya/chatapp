// src/utils/userHelper.js
// Helper to get or create MongoDB user by Clerk ID

const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Get or create MongoDB user by Clerk ID
 * @param {string} clerkId - Clerk user ID
 * @param {string} email - User email from Clerk
 * @returns {Promise<Object>} MongoDB user document
 * @throws {Error} If MongoDB is not connected or operation fails
 */
async function getOrCreateUser(clerkId, email) {
  if (!clerkId || !email) {
    throw new Error('clerkId and email are required');
  }

  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB is not connected. Please check your MONGO_URI and ensure MongoDB is running.');
  }

  try {
    let user = await User.findOne({ clerkId });
    
    if (!user) {
      // Create user record if doesn't exist
      user = await User.create({
        clerkId,
        email
      });
    } else if (user.email !== email) {
      // Update email if it changed in Clerk
      user.email = email;
      await user.save();
    }
    
    return user;
  } catch (error) {
    if (error.name === 'MongoServerError' || error.name === 'MongoNetworkError') {
      throw new Error('Database connection error. Please check MongoDB connection.');
    }
    throw error;
  }
}

module.exports = { getOrCreateUser };

