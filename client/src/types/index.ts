// client/src/types/index.ts
export interface Message {
  _id?: string;
  conversationId: string;
  fromUserId?: string;
  fromEmail?: string;
  ciphertext?: string; // base64
  iv?: string;         // base64
  tag?: string;
  text?: string;       // decrypted plaintext (client-only)
  ts: string | number | Date;
  status?: 'sent'|'delivered'|'read';
}

export interface Conversation {
  _id: string;
  title?: string;
  participants: string[]; // user IDs
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  // optional: chatKey could be provided by server for a convo
  chatKey?: string;
}

export interface SendMessagePayload {
  roomId: string;
  ciphertext: string;
  iv: string;
  tag?: string;
  text?: string;
}

export interface ApiError {
  error: string;
  [k: string]: any;
}
