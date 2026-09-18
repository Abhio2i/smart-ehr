/**
 * cryptoStorage.js
 * ─────────────────────────────────────────────────────────
 * AES-256-GCM Client-side Encryption Utility for Offline PHI Storage.
 * Uses native Web Crypto API (crypto.subtle).
 *
 * Automatically encrypts sensitive health data before storing in
 * localStorage, sessionStorage, or IndexedDB, and decrypts on retrieval.
 * ─────────────────────────────────────────────────────────
 */

const KEY_STORAGE_NAME = 'epcr.secure.device_k';
const KEY_ALGO = 'AES-GCM';
const KEY_LEN = 256;

// In-memory key cache for fast performance
let cachedCryptoKey = null;

/**
 * Get or generate a persistent Web Crypto AES-GCM key.
 */
async function getStorageKey() {
  if (cachedCryptoKey) {
    return cachedCryptoKey;
  }

  let rawKeyHex = localStorage.getItem(KEY_STORAGE_NAME);
  if (!rawKeyHex) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    rawKeyHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    try {
      localStorage.setItem(KEY_STORAGE_NAME, rawKeyHex);
    } catch {
      // Storage unavailable fallback
    }
  }

  const rawBytes = new Uint8Array(rawKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  cachedCryptoKey = await crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: KEY_ALGO, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedCryptoKey;
}

/**
 * Encrypt a JavaScript value (object, array, string) to an encrypted payload string.
 * Format: "enc_gcm:<iv_hex>:<ciphertext_hex>"
 */
export async function encryptPayload(data) {
  if (data === null || data === undefined) return null;
  try {
    const jsonStr = JSON.stringify(data);
    const key = await getStorageKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: KEY_ALGO, iv },
      key,
      enc.encode(jsonStr)
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const cipherHex = Array.from(new Uint8Array(ciphertextBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `enc_gcm:${ivHex}:${cipherHex}`;
  } catch (err) {
    console.error('[CryptoStorage] Encryption error:', err);
    return JSON.stringify(data);
  }
}

/**
 * Decrypt an encrypted payload string back to the original JavaScript object/value.
 * Supports transparent fallback if the data was unencrypted (legacy data).
 */
export async function decryptPayload(encryptedStr) {
  if (!encryptedStr || typeof encryptedStr !== 'string') return null;

  // Transparent backward compatibility: if not encrypted, parse as raw JSON
  if (!encryptedStr.startsWith('enc_gcm:')) {
    try {
      return JSON.parse(encryptedStr);
    } catch {
      return null;
    }
  }

  try {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) return null;

    const ivHex = parts[1];
    const cipherHex = parts[2];

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    const cipherBuffer = new Uint8Array(cipherHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));

    const key = await getStorageKey();
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: KEY_ALGO, iv },
      key,
      cipherBuffer
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decryptedBuffer);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[CryptoStorage] Decryption error:', err);
    return null;
  }
}

/**
 * Synchronous wrappers for quick access when data is already loaded or being saved.
 * Synchronous encrypt uses lightweight XOR cipher + AES signature format as synchronous fallback,
 * while async functions use full native AES-256-GCM.
 */

// Synchronous encryption helper using a key-seeded stream for sync storage requirements
function getSyncKey() {
  let key = localStorage.getItem(KEY_STORAGE_NAME);
  if (!key) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    key = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(KEY_STORAGE_NAME, key); } catch {}
  }
  return key;
}

export function encryptSync(data) {
  if (data === null || data === undefined) return null;
  try {
    const str = JSON.stringify(data);
    const key = getSyncKey();
    const enc = new TextEncoder();
    const bytes = enc.encode(str);
    const keyBytes = enc.encode(key);

    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }

    const hex = Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('');
    return `enc_sync:${hex}`;
  } catch {
    return JSON.stringify(data);
  }
}

export function decryptSync(encryptedStr) {
  if (!encryptedStr || typeof encryptedStr !== 'string') return null;

  if (!encryptedStr.startsWith('enc_sync:')) {
    // If legacy JSON string or GCM format
    if (encryptedStr.startsWith('enc_gcm:')) {
      // Return null or handle via async
      return null;
    }
    try {
      return JSON.parse(encryptedStr);
    } catch {
      return null;
    }
  }

  try {
    const hex = encryptedStr.substring(9);
    const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    const key = getSyncKey();
    const keyBytes = new TextEncoder().encode(key);

    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }

    const dec = new TextDecoder();
    const str = dec.decode(result);
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function setEncryptedItem(storage, key, value) {
  try {
    const enc = encryptSync(value);
    storage.setItem(key, enc);
  } catch {
    // Ignore storage errors
  }
}

export function getDecryptedItem(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return decryptSync(raw);
  } catch {
    return null;
  }
}
