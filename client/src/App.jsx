// client/src/main.jsx (or App root)
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={publishableKey}>
    <App />
  </ClerkProvider>
);
// client/src/App.jsx
// UI-only updates — no routing/auth logic changes
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Conversations from './pages/Conversations';
import VerifyEmail from './pages/VerifyEmail';
import Header from './components/Header';
import { initTheme } from './utils/ui';

// small auth helper
const isAuthed = () => {
  try { return !!localStorage.getItem('TOKEN'); } catch { return false; }
};

export default function App(){
  useEffect(() => {
    initTheme();
    document.title = 'Socket';
  }, []);

  return (
    <Router>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={ isAuthed() ? <Navigate to="/conversations" replace /> : <Navigate to="/login" replace /> } />
          <Route path="/login" element={ <Login /> } />
          <Route path="/register" element={ <Register /> } />
          <Route path="/verify-email" element={ <VerifyEmail /> } />
          <Route path="/chat" element={ isAuthed() ? <Navigate to="/conversations" replace /> : <Navigate to="/login" replace /> } />
          <Route path="/conversations" element={ isAuthed() ? <Conversations /> : <Navigate to="/login" replace /> } />
          <Route path="/chat/:conversationId" element={ isAuthed() ? <Chat /> : <Navigate to="/login" replace /> } />
        </Routes>
      </main>
    </Router>
  );
}
