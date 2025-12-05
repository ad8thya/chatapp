// client/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiLogin } from '../utils/auth';

function generateChatKeyBase64() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  let str = '';
  for (let i = 0; i < raw.length; ++i) str += String.fromCharCode(raw[i]);
  return btoa(str);
}

export default function Login(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setErr('');
    setBusy(true);
    try {
      const res = await apiLogin(email.trim(), password);
      console.log('login response ->', res);
      // defensive: handle different shapes
      const token = res?.token || (res?.data && res.data.token) || (res?.accessToken);
      if (!token) {
        throw new Error('login response missing token');
      }
      // store token
      localStorage.setItem('TOKEN', token);
      // after localStorage.setItem('TOKEN', token);
      if (res.user) {
        try { localStorage.setItem('USER', JSON.stringify(res.user)); } catch(e) {}
      }


      // ensure a CHAT_KEY exists for demo: reuse existing or generate
      if (!localStorage.getItem('CHAT_KEY')) {
        const k = generateChatKeyBase64();
        localStorage.setItem('CHAT_KEY', k);
      }

      // use SPA navigation to conversations (no full reload)
      nav('/conversations', { replace: true });
    } catch (err) {
      console.error('login error', err);
      setErr(err?.error || err?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{padding:20, maxWidth:420, margin:'3rem auto', border:'1px solid #ddd', borderRadius:8}}>
      <h2 style={{marginBottom:8}}>Login</h2>
      <form onSubmit={onSubmit}>
        <label style={{display:'block', marginBottom:6}}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required style={{width:'100%',padding:8,marginBottom:12}} />
        <label style={{display:'block', marginBottom:6}}>Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required style={{width:'100%',padding:8,marginBottom:12}} />
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button disabled={busy} style={{padding:'8px 12px'}}>Login</button>
          <Link to="/register">Register</Link>
        </div>
        {err && <div style={{color:'crimson', marginTop:12}}>{err}</div>}
      </form>
    </div>
  );
}
