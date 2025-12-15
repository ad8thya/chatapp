// client/src/pages/Login.jsx
// Clerk-based authentication - uses Clerk SignIn component
import React from 'react';
import { SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

export default function Login() {
  return (
    <>
      <SignedIn>
        <Navigate to="/conversations" replace />
      </SignedIn>
      <SignedOut>
        <div className="auth-page">
          <div className="auth-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <SignIn 
              routing="path"
              path="/login"
              signUpUrl="/register"
              afterSignInUrl="/conversations"
            />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
