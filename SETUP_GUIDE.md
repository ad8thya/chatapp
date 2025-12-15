# Setup Guide - Clerk Authentication

## Required Environment Variables

### Server (.env)
```env
# Required
CLERK_SECRET_KEY=sk_test_...  # Get from Clerk Dashboard > API Keys
MONGO_URI=mongodb://localhost:27017/chatapp  # Or MongoDB Atlas connection string
PORT=3000

# Optional
MONGODB_URI=mongodb://localhost:27017/chatapp  # Alternative to MONGO_URI
```

### Client (client/.env)
```env
VITE_SERVER_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...  # Get from Clerk Dashboard
```

## Setting Up Clerk JWT Template

The application requires a JWT template named "default" in your Clerk dashboard.

### Steps:

1. **Go to Clerk Dashboard**
   - Visit https://dashboard.clerk.com
   - Select your application

2. **Navigate to JWT Templates**
   - Go to **Configure** → **JWT Templates**
   - Click **+ New template**

3. **Create "default" Template**
   - Name: `default` (exactly this name, case-sensitive)
   - Token lifetime: Set as needed (default is fine)
   - Signing algorithm: RS256 (recommended) or HS256

4. **Add Claims (Optional but Recommended)**
   - `email`: `{{user.primary_email_address}}`
   - `userId`: `{{user.id}}`
   - Or leave empty if you only need the default `sub` claim

5. **Save the Template**
   - Click **Save**
   - The template will be available immediately

## Verifying Setup

1. **Check Server Logs**
   - Start the server: `node src/server.js`
   - You should see:
     ```
     ✓ MongoDB connected successfully
     ✓ Server listening on port 3000
     ✓ Database connected
     ✓ Clerk authentication enabled
     ```

2. **Check Frontend**
   - Start the client: `cd client && npm run dev`
   - Sign in with Clerk
   - If you see "Failed to get authentication token", verify:
     - JWT template "default" exists in Clerk dashboard
     - `VITE_CLERK_PUBLISHABLE_KEY` is set correctly
     - `CLERK_SECRET_KEY` is set correctly on server

## Troubleshooting

### "Failed to get authentication token"
- **Cause**: JWT template "default" doesn't exist
- **Fix**: Create the template in Clerk dashboard (see steps above)

### "MongoDB is not connected"
- **Cause**: MongoDB connection failed
- **Fix**: 
  - Check `MONGO_URI` is correct
  - Ensure MongoDB is running (local) or connection string is valid (Atlas)
  - Check network/firewall settings

### "CLERK_SECRET_KEY is required"
- **Cause**: Server environment variable not set
- **Fix**: Add `CLERK_SECRET_KEY=sk_test_...` to your `.env` file

### "user_email_required"
- **Cause**: User email not found in Clerk user object
- **Fix**: Ensure user has verified email in Clerk dashboard


