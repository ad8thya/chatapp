// client/src/utils/offlineQueue.js
// Offline queue using IndexedDB (idb wrapper)
// Persists unsent messages and flushes on reconnection

import { openDB } from 'idb';

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('chat-offline-queue', 1, {
      upgrade(db) {
        const store = db.createObjectStore('unsentMessages', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-conversation', 'conversationId');
        store.createIndex('by-timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
}

/**
 * Add unsent message to queue
 */
export async function addUnsentMessage(conversationId, payload) {
  const db = await getDB();
  const tx = db.transaction('unsentMessages', 'readwrite');
  const store = tx.objectStore('unsentMessages');
  
  const message = {
    conversationId,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };
  
  const id = await store.add(message);
  await tx.done;
  return id;
}

/**
 * List unsent messages for a conversation
 */
export async function listUnsentMessages(conversationId) {
  const db = await getDB();
  const tx = db.transaction('unsentMessages', 'readonly');
  const index = tx.store.index('by-conversation');
  const messages = await index.getAll(conversationId);
  await tx.done;
  return messages;
}

/**
 * List all unsent messages (across all conversations)
 */
export async function listAllUnsentMessages() {
  const db = await getDB();
  const tx = db.transaction('unsentMessages', 'readonly');
  const messages = await tx.store.getAll();
  await tx.done;
  return messages;
}

/**
 * Remove unsent message by ID
 */
export async function removeUnsentMessage(id) {
  const db = await getDB();
  const tx = db.transaction('unsentMessages', 'readwrite');
  await tx.store.delete(id);
  await tx.done;
}

/**
 * Increment retry count for a message
 */
export async function incrementRetry(id) {
  const db = await getDB();
  const tx = db.transaction('unsentMessages', 'readwrite');
  const message = await tx.store.get(id);
  if (message) {
    message.retries += 1;
    await tx.store.put(message);
  }
  await tx.done;
}

/**
 * Flush unsent messages for a conversation
 * Attempts to send all queued messages via provided send function
 * Removes successfully sent messages from queue
 */
export async function flushUnsent(conversationId, sendFn) {
  const messages = await listUnsentMessages(conversationId);
  let sent = 0;
  let failed = 0;

  for (const msg of messages) {
    try {
      // Max 3 retries per message
      if (msg.retries >= 3) {
        console.warn(`Message ${msg.id} exceeded max retries, removing from queue`);
        await removeUnsentMessage(msg.id);
        failed++;
        continue;
      }

      const success = await sendFn(msg.payload);
      if (success) {
        await removeUnsentMessage(msg.id);
        sent++;
      } else {
        await incrementRetry(msg.id);
        failed++;
      }
    } catch (err) {
      console.error('Flush error for message', msg.id, err);
      await incrementRetry(msg.id);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Clear all unsent messages (use with caution)
 */
export async function clearAllUnsent() {
  const db = await getDB();
  const tx = db.transaction('unsentMessages', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

