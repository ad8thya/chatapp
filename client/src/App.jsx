
import React from 'react';
import Chat from './pages/Chat';

export default function App() {
  // change conversationId if you want multiple rooms
  return <Chat conversationId="room1" />;
}