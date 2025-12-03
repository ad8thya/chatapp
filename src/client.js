// client.js — Node client that requires TOKEN and supports demo CHAT_KEY
// Usage (PowerShell):
// $env:TOKEN="..." ; $env:CHAT_KEY="..." ; node client.js

const { io } = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

// config
const SERVER = process.env.SERVER_URL || "http://localhost:3000";
const TOKEN = process.env.TOKEN; // MUST be provided
let CHAT_KEY_B64 = process.env.CHAT_KEY; // optional (will be generated)

// require token (server expects JWT)
if (!TOKEN) {
  console.error("ERROR: TOKEN (JWT) must be provided as an env var. Set $env:TOKEN in PowerShell.");
  process.exit(1);
}

// key handling
let RAW_KEY;
if (CHAT_KEY_B64 && CHAT_KEY_B64.trim()) {
  try {
    RAW_KEY = Buffer.from(CHAT_KEY_B64.trim(), "base64");
    if (RAW_KEY.length !== 32) {
      console.error("CHAT_KEY must be 32 bytes when base64-decoded (AES-256). Current length:", RAW_KEY.length);
      process.exit(1);
    }
  } catch (e) {
    console.error("Invalid CHAT_KEY base64:", e.message);
    process.exit(1);
  }
} else {
  RAW_KEY = crypto.randomBytes(32);
  CHAT_KEY_B64 = RAW_KEY.toString("base64");
  console.log("No CHAT_KEY provided. Generated demo key (base64). Use this on the other client to decrypt messages:");
  console.log(CHAT_KEY_B64);
  console.log('Run the other client as: $env:CHAT_KEY="' + CHAT_KEY_B64 + '" ; node client.js');
  console.log("(For this terminal, messages will be encrypted with this generated key.)\n");
}

// encryption helpers
function encryptText(plain, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv, { authTagLength: 16 });
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64") };
}

function decryptText(ciphertextB64, ivB64, tagB64, keyBuffer) {
  try {
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch (e) {
    return null;
  }
}

// connect with token in handshake auth
const socket = io(SERVER, {
  auth: { token: TOKEN },
  reconnectionDelayMax: 10000
});

// debug connect error (auth issues surface here)
socket.on("connect_error", (err) => {
  console.error("connect_error:", err && err.message ? err.message : err);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });

socket.on("connect", () => {
  console.log("Connected:", socket.id);
  console.log("Using CHAT_KEY (base64):", CHAT_KEY_B64);
  rl.prompt();
});

socket.on("message", (msg) => {
  if (msg.ciphertext && msg.iv && msg.tag) {
    const plaintext = decryptText(msg.ciphertext, msg.iv, msg.tag, RAW_KEY);
    if (plaintext === null) {
      console.log(`\n[${msg.roomId}] ${msg.fromEmail || msg.from} @ ${msg.ts}: <unable to decrypt>`);
    } else {
      console.log(`\n[${msg.roomId}] ${msg.fromEmail || msg.from} @ ${msg.ts}: ${plaintext}`);
    }
  } else if (msg.text) {
    console.log(`\n[${msg.roomId}] ${msg.fromEmail || msg.from} @ ${msg.ts}: ${msg.text}`);
  } else {
    console.log("\n[message] unknown format", msg);
  }
  rl.prompt();
});

socket.on("presence", (ev) => { console.log(`\n[presence] ${ev.type} ${ev.socketId} in ${ev.roomId}`); rl.prompt(); });
socket.on("error", (e) => { console.log("Error:", e); rl.prompt(); });
socket.on("disconnect", (reason) => { console.log("Disconnected:", reason); });

// commands help
console.log("Commands:");
console.log("/join <roomId>     — join a room");
console.log("/leave <roomId>    — leave a room");
console.log("/who               — show my socket id");
console.log("/rooms             — ask server which rooms I'm in");
console.log("typing plain text will send an encrypted message to the last joined room");
console.log("");

let lastRoom = null;

function sendEncrypted(roomId, plainText) {
  const enc = encryptText(plainText, RAW_KEY);
  const payload = { roomId, ciphertext: enc.ciphertext, iv: enc.iv, tag: enc.tag };
  socket.emit("send_message", payload, (ack) => { /* optional ack */ });
}

rl.on("line", (line) => {
  const input = line.trim();
  if (!input) return rl.prompt();

  if (input.startsWith("/join ")) {
    const roomId = input.split(" ")[1];
    if (!roomId) { console.log("usage: /join <roomId>"); return rl.prompt(); }
    socket.emit("join_conversation", roomId, (ack) => {
      console.log("join ack:", ack);
      if (ack && ack.ok) lastRoom = roomId;
      rl.prompt();
    });
  } else if (input.startsWith("/leave ")) {
    const roomId = input.split(" ")[1];
    socket.emit("leave_conversation", roomId, (ack) => {
      console.log("leave ack:", ack);
      if (ack && ack.ok && lastRoom === roomId) lastRoom = null;
      rl.prompt();
    });
  } else if (input === "/who") {
    console.log("Socket id:", socket.id);
    rl.prompt();
  } else if (input === "/rooms") {
    socket.emit("list_my_rooms", (res) => {
      console.log("my rooms:", res.rooms);
      rl.prompt();
    });
  } else {
    if (!lastRoom) {
      console.log("No room joined. Use /join <roomId>");
      return rl.prompt();
    } else {
      sendEncrypted(lastRoom, input);
      rl.prompt();
    }
  }
});
