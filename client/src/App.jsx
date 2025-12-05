// client/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Conversations from './pages/Conversations';
import Header from './components/Header';

// small auth helper
const isAuthed = () => {
  try { return !!localStorage.getItem('TOKEN'); } catch { return false; }
};

export default function App(){
  return (
    <Router>
      {/* header rendered for all routes — it shows login state and logout control */}
      <Header />
      <main style={{ paddingTop: 12 }}>
        <Routes>
          <Route path="/" element={ isAuthed() ? <Navigate to="/conversations" replace /> : <Navigate to="/login" replace /> } />
          <Route path="/login" element={ <Login /> } />
          <Route path="/register" element={ <Register /> } />
          <Route path="/chat" element={ isAuthed() ? <Navigate to="/conversations" replace /> : <Navigate to="/login" replace /> } />
          <Route path="/conversations" element={ isAuthed() ? <Conversations /> : <Navigate to="/login" replace /> } />
          <Route path="/chat/:conversationId" element={ isAuthed() ? <Chat /> : <Navigate to="/login" replace /> } />
        </Routes>
      </main>
    </Router>
  );
}
