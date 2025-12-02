// client.js — AES-GCM demo (Node). Both clients must use same CHAT_KEY (base64) to decrypt each other.
// Usage:
//   CHAT_KEY=<base64key> node client.js
// If CHAT_KEY is not provided the script will generate one and print it; copy it and re-run the other client with that key.

const { io } = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

// --- Config / Key management ---
const SERVER = "http://localhost:3000";
const KEY_ENV = process.env.CHAT_KEY; // base64 key (32 bytes -> AES-256)
let RAW_KEY = null;

if (KEY_ENV && KEY_ENV.trim()) {
  try {
    RAW_KEY = Buffer.from(KEY_ENV.trim(), 'base64');
    if (RAW_KEY.length !== 32) {
      console.error('CHAT_KEY must be 32 bytes when base64-decoded (AES-256). Current length:', RAW_KEY.length);
      process.exit(1);
    }
  } catch (e) {
    console.error('Invalid CHAT_KEY base64. Error:', e.message);
    process.exit(1);
  }
} else {
  // generate a key and print it for the user to copy
  RAW_KEY = crypto.randomBytes(32);
  const printed = RAW_KEY.toString('base64');
  console.log('No CHAT_KEY provided. Generated demo key (base64). Use this on the other client to decrypt messages:');
  console.log(printed);
  console.log('Run the other client as: CHAT_KEY=' + printed + ' node client.js');
  console.log('(For this terminal, messages will be encrypted with this generated key.)\n');
}

// Helper: AES-GCM encrypt/decrypt
function encryptText(plain, keyBuffer) {
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv, { authTagLength: 16 });
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

function decryptText(ciphertextB64, ivB64, tagB64, keyBuffer) {
  try {
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch (e) {
    // decryption failed (wrong key / tampered)
    return null;
  }
}

// --- Socket + CLI setup ---
const socket = io(SERVER, { reconnectionDelayMax: 10000 });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });

socket.on("connect", () => {
  console.log("Connected:", socket.id);
  rl.prompt();
});

socket.on("message", (msg) => {
  // message expected shape (server side unchanged): { from, roomId, text, ts } earlier
  // Now we'll accept ciphertext fields if present
  if (msg.ciphertext && msg.iv && msg.tag) {
    const plaintext = decryptText(msg.ciphertext, msg.iv, msg.tag, RAW_KEY);
    if (plaintext === null) {
      console.log(`\n[${msg.roomId}] ${msg.from} @ ${msg.ts}: <unable to decrypt>`);
    } else {
      console.log(`\n[${msg.roomId}] ${msg.from} @ ${msg.ts}: ${plaintext}`);
    }
  } else if (msg.text) {
    // backwards compatibility: plaintext messages
    console.log(`\n[${msg.roomId}] ${msg.from} @ ${msg.ts}: ${msg.text}`);
  } else {
    console.log('\n[message] unknown format', msg);
  }
  rl.prompt();
});

socket.on("presence", (ev) => { console.log(`\n[presence] ${ev.type} ${ev.socketId} in ${ev.roomId}`); rl.prompt(); });
socket.on("error", (e) => { console.log("Error:", e); rl.prompt(); });
socket.on("disconnect", () => { console.log("Disconnected from server"); });

// CLI commands help
console.log("Commands:");
console.log("/join <roomId>     — join a room");
console.log("/leave <roomId>    — leave a room");
console.log("/who               — show my socket id");
console.log("/rooms             — ask server which rooms I'm in");
console.log("typing plain text will send an encrypted message to the last joined room");
console.log("");

let lastRoom = null;

// --- send wrapper: encrypt before emit ---
function sendEncrypted(roomId, plainText) {
  const enc = encryptText(plainText, RAW_KEY);
  // payload matches earlier server expectation but with ciphertext fields
  const payload = {
    roomId,
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    tag: enc.tag
  };
  socket.emit('send_message', payload, (ack) => {
    // optional acknowledgement
  });
}

rl.on('line', (line) => {
  const input = line.trim();
  if (!input) return rl.prompt();

  if (input.startsWith('/join ')) {
    const roomId = input.split(' ')[1];
    if (!roomId) { console.log('usage: /join <roomId>'); return rl.prompt(); }
    socket.emit('join_conversation', roomId, (ack) => {
      console.log('join ack:', ack);
      if (ack && ack.ok) lastRoom = roomId;
      rl.prompt();
    });
  } else if (input.startsWith('/leave ')) {
    const roomId = input.split(' ')[1];
    socket.emit('leave_conversation', roomId, (ack) => {
      console.log('leave ack:', ack);
      if (ack && ack.ok && lastRoom === roomId) lastRoom = null;
      rl.prompt();
    });
  } else if (input === '/who') {
    console.log('Socket id:', socket.id);
    rl.prompt();
  } else if (input === '/rooms') {
    socket.emit('list_my_rooms', (res) => {
      console.log('my rooms:', res.rooms);
      rl.prompt();
    });
  } else {
    if (!lastRoom) {
      console.log("No room joined. Use /join <roomId>");
      return rl.prompt();
    } else {
      // encrypt and send
      sendEncrypted(lastRoom, input);
      rl.prompt();
    }
  }
});
