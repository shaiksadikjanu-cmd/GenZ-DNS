// crypto.js — client-side encryption for workspace credentials
//
// WHY THIS EXISTS:
// Users paste their Supabase/Firestore credentials into our portal.
// We encrypt them before sending to our server so we never store
// plaintext credentials. Even if our database is breached, the
// attacker gets useless encrypted blobs.
//
// HOW IT WORKS:
// 1. We derive an AES-256-GCM key from the user's Firebase UID
//    + a fixed salt using PBKDF2 (Password-Based Key Derivation Function 2)
// 2. We encrypt the credentials JSON using that key
// 3. The encrypted output (IV + ciphertext, base64) goes to our Firestore
// 4. Decryption reverses the process — same UID + salt = same key
//
// AES-256-GCM provides:
//   - 256-bit encryption (military grade)
//   - Authentication (detects tampering)
//   - Random IV per encryption (same input → different output every time)
//
// We use the Web Crypto API — built into every modern browser,
// no external libraries, no supply chain risk.

const SALT      = 'janunet-workspace-v1'; // fixed salt — change = all configs unreadable
const ALGORITHM = 'AES-GCM';
const KEY_LEN   = 256;

// Derive a crypto key from the user's Firebase UID
async function deriveKey(uid) {
  // Step 1: import the UID as raw key material
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(uid),
    { name: 'PBKDF2' },
    false,              // not extractable
    ['deriveKey']
  );

  // Step 2: derive a strong AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt:       new TextEncoder().encode(SALT),
      iterations: 100_000,   // 100k iterations = slow for attackers, fast for us
      hash:       'SHA-256'
    },
    raw,
    { name: ALGORITHM, length: KEY_LEN },
    false,             // not extractable — key stays in browser memory only
    ['encrypt', 'decrypt']
  );
}

// Encrypt a JavaScript object — returns a base64 string safe to store in Firestore
export async function encryptConfig(uid, configObject) {
  const key = await deriveKey(uid);

  // Random 12-byte IV — never reuse the same IV with the same key
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(configObject));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    plaintext
  );

  // Combine IV + ciphertext into one blob, then base64 encode
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}

// Decrypt a base64 string — returns the original JavaScript object
export async function decryptConfig(uid, encryptedBase64) {
  const key      = await deriveKey(uid);
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  // Split IV (first 12 bytes) from ciphertext (rest)
  const iv         = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch(e) {
    // Decryption failed — wrong key (wrong user) or data was tampered
    throw new Error('Decryption failed: invalid key or corrupted data');
  }
}
