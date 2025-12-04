// client/src/utils/auth.js
const BASE = 'http://localhost:3000';

async function safeParse(res) {
  const text = await res.text();
  if (!text) return { __empty: true, status: res.status };
  try { return JSON.parse(text); } catch (e) {
    return { __raw: text, status: res.status };
  }
}

export async function apiLogin(email, password) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await safeParse(res);
  if (!res.ok) throw body;
  return body;
}

export async function apiRegister(email, password, displayName) {
  const res = await fetch(BASE + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName })
  });
  const body = await safeParse(res);
  if (!res.ok) throw body;
  return body;
}
