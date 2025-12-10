// client/src/utils/cryptoKeyManager.js
// Centralized crypto key management for AES-GCM encryption

const STORAGE_KEY = 'CHAT_KEY';

// ============================================
// Base64 <-> ArrayBuffer conversions
// ============================================

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(b64) {
  if (!b64 || typeof b64 !== 'string') return new ArrayBuffer(0);
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ============================================
// Key validation and generation
// ============================================

export function validateKey(b64) {
  if (!b64 || typeof b64 !== 'string') return false;
  try {
    const trimmed = b64.trim();
    if (trimmed.length < 40) return false; // base64 of 32 bytes should be ~44 chars
    const buf = base64ToArrayBuffer(trimmed);
    return buf.byteLength === 32;
  } catch (e) {
    return false;
  }
}

function generateNewKey() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase64(raw.buffer);
}

// ============================================
// Key storage operations
// ============================================

export function setChatKey(b64) {
  if (!b64 || typeof b64 !== 'string') {
    console.error('setChatKey: invalid input');
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, b64.trim());
  } catch (e) {
    console.error('setChatKey: localStorage failed', e);
  }
}

export function getChatKeyBase64() {
  try {
    let key = localStorage.getItem(STORAGE_KEY);
    if (!key || !validateKey(key)) {
      console.warn('No valid CHAT_KEY found, generating new key');
      key = generateNewKey();
      setChatKey(key);
    }
    return key.trim();
  } catch (e) {
    console.error('getChatKeyBase64 failed', e);
    const key = generateNewKey();
    setChatKey(key);
    return key;
  }
}

// ============================================
// CryptoKey import
// ============================================

export async function getChatKey() {
  const b64 = getChatKeyBase64();
  try {
    const raw = base64ToArrayBuffer(b64);
    return await crypto.subtle.importKey(
      'raw',
      raw,
      'AES-GCM',
      true,
      ['encrypt', 'decrypt']
    );
  } catch (e) {
    console.error('getChatKey: import failed', e);
    throw e;
  }
}