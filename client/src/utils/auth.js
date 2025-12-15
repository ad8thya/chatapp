// client/src/utils/auth.js
// Centralized authentication token helper

import { useAuth } from '@clerk/clerk-react';

/**
 * Get authentication token from Clerk
 * Fails loudly if token cannot be retrieved
 * @returns {Promise<string>} JWT token
 * @throws {Error} If token cannot be retrieved
 */
export async function getAuthToken(getToken) {
  if (!getToken) {
    throw new Error('getToken function not available. User may not be authenticated.');
  }

  try {
    const token = await getToken({ template: 'default' });
    
    if (!token) {
      throw new Error('Failed to get authentication token. JWT template "default" may not exist in Clerk dashboard. Please create a JWT template named "default" in your Clerk dashboard under JWT Templates.');
    }
    
    return token;
  } catch (error) {
    // Check for specific Clerk errors
    if (error.message && (
      error.message.includes('template') || 
      error.message.includes('No JWT template') ||
      error.message.includes('jwt_template')
    )) {
      throw new Error('JWT template "default" not found. Please create it in your Clerk dashboard:\n1. Go to Clerk Dashboard > JWT Templates\n2. Create a new template named "default"\n3. Add any claims you need (email, userId, etc.)\n4. Save and try again.');
    }
    
    // Re-throw with more context
    throw new Error(`Failed to get authentication token: ${error.message || error}`);
  }
}

/**
 * Get user email from Clerk user object
 * Fails loudly if email is missing
 * @param {Object} user - Clerk user object
 * @returns {string} User email
 * @throws {Error} If email is missing
 */
export function getUserEmail(user) {
  if (!user) {
    throw new Error('User object not available');
  }

  const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || null;
  
  if (!email) {
    throw new Error('User email not found in Clerk user object');
  }
  
  return email;
}
