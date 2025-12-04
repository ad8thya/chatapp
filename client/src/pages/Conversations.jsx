import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Conversations(){
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [emails, setEmails] = useState('');
  const nav = useNavigate();
  const token = localStorage.getItem('TOKEN');

  // Fetch conversations
  useEffect(() => {
    fetch('http://localhost:3000/api/conversations', {
      headers: { Authorization: 'Bearer ' + token }
    })
    .then(r => r.json())
    .then(setList)
    .catch(console.error);
  }, []);

  const createConversation = async () => {
    const res = await fetch('http://localhost:3000/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        title,
        participantEmails: emails.split(',').map(e => e.trim())
      })
    });

    const data = await res.json();
    // Navigate directly to new convo
    nav(`/chat/${data._id}`);
  };

  return (
    <div style={{ padding:20 }}>
      <h2>Your Conversations</h2>

      {list.map(c => (
        <div key={c._id}>
          <Link to={`/chat/${c._id}`}>{c.title}</Link>
        </div>
      ))}

      <h3>Create Conversation</h3>

      <input
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <input
        placeholder="Participant emails (comma separated)"
        value={emails}
        onChange={e => setEmails(e.target.value)}
      />

      <button onClick={createConversation}>Create</button>
    </div>
  );
}
