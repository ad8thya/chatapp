// client/src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiRegister } from '../utils/auth';

function generateChatKeyBase64() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  let str = '';
  for (let i = 0; i < raw.length; ++i) str += String.fromCharCode(raw[i]);
  return btoa(str);
}

export default function Register(){
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setErr('');
    setBusy(true);
    try {
      const res = await apiRegister(email.trim(), password, displayName.trim());
      console.log('register response ->', res);
      const token = res?.token || (res?.data && res.data.token) || (res?.accessToken);
      if (!token) throw new Error('registration response missing token');

      localStorage.setItem('TOKEN', token);
      // create a fresh CHAT_KEY for the user (demo)
      const k = generateChatKeyBase64();
      localStorage.setItem('CHAT_KEY', k);

      window.location.href = '/chat';
    } catch (e) {
      console.error('register error', e);
      setErr(e?.error || e?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{padding:20, maxWidth:420, margin:'3rem auto', border:'1px solid #ddd', borderRadius:8}}>
      <h2 style={{marginBottom:8}}>Register</h2>
      <form onSubmit={onSubmit}>
        <label style={{display:'block', marginBottom:6}}>Display name</label>
        <input value={displayName} onChange={e=>setDisplayName(e.target.value)} required style={{width:'100%',padding:8,marginBottom:12}} />
        <label style={{display:'block', marginBottom:6}}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required style={{width:'100%',padding:8,marginBottom:12}} />
        <label style={{display:'block', marginBottom:6}}>Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required style={{width:'100%',padding:8,marginBottom:12}} />
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button disabled={busy} style={{padding:'8px 12px'}}>Create account</button>
          <Link to="/login">Back to login</Link>
        </div>
        {err && <div style={{color:'crimson', marginTop:12}}>{err}</div>}
      </form>
    </div>
  );
}
