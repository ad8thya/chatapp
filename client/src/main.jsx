// client/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  console.error('✗ ERROR: VITE_CLERK_PUBLISHABLE_KEY is required but not set');
  console.error('   Please set VITE_CLERK_PUBLISHABLE_KEY in your client/.env file');
  document.body.innerHTML = `
    <div style="padding: 2rem; font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #d32f2f;">Configuration Error</h1>
      <p><strong>VITE_CLERK_PUBLISHABLE_KEY</strong> is not set in your environment variables.</p>
      <p>Please:</p>
      <ol>
        <li>Create or edit <code>client/.env</code> file</li>
        <li>Add: <code>VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</code></li>
        <li>Get your publishable key from <a href="https://dashboard.clerk.com" target="_blank">Clerk Dashboard</a></li>
        <li>Restart your development server</li>
      </ol>
    </div>
  `;
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ClerkProvider publishableKey={publishableKey}>
      <App />
    </ClerkProvider>
  );
}
