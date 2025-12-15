// client/src/pages/Register.jsx
// Clerk-based authentication - uses Clerk SignUp component
// Clerk automatically handles email verification at /register/verify-email-address
import React from 'react';
import { SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

export default function Register() {
  return (
    <>
      <SignedIn>
        <Navigate to="/conversations" replace />
      </SignedIn>
      <SignedOut>
        <div className="auth-page">
          <div className="auth-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <SignUp 
              routing="path"
              path="/register"
              signInUrl="/login"
              afterSignUpUrl="/conversations"
            />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
