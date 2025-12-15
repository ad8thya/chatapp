// client/src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Conversations from './pages/Conversations';
import Header from './components/Header';
import { initTheme } from './utils/ui';
import { useAuthContext } from './context/AuthContext';

// Protected route wrapper using JWT auth
function ProtectedRoute({ children }) {
  const { token, user, loading } = useAuthContext();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

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
          <Route path="/" element={<Navigate to="/conversations" replace />} />
          <Route path="/login/*" element={<Login />} />
          <Route path="/register/*" element={<Register />} />
          <Route path="/chat" element={<Navigate to="/conversations" replace />} />
          <Route 
            path="/conversations" 
            element={
              <ProtectedRoute>
                <Conversations />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chat/:conversationId" 
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>
    </Router>
  );
}
