/**
 * Offline Resilience Cryptographic Utility for in-Time
 * Menggunakan CSPRNG (crypto.getRandomValues) dan PBKDF2-HMAC-SHA256 (10.000 iterasi)
 * untuk penyimpanan hash lokal tanpa secret/salt statis di bundle klien.
 * Catatan: Autentikasi dan hashing utama produksi berjalan di Backend Laravel (bcrypt).
 */

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const SHA256_INIT = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const textEncoder = new TextEncoder();

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Bytes(input: Uint8Array): Uint8Array {
  const bitLen = input.length * 8;
  const totalLen = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(totalLen);
  padded.set(input);
  padded[input.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);

  const hash = new Uint32Array(SHA256_INIT);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) {
    outView.setUint32(i * 4, hash[i], false);
  }
  return out;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const normalizedKey = key.length > 64 ? sha256Bytes(key) : key;
  const oKeyPad = new Uint8Array(64 + 32);
  const iKeyPad = new Uint8Array(64 + message.length);

  for (let i = 0; i < 64; i++) {
    const k = i < normalizedKey.length ? normalizedKey[i] : 0;
    oKeyPad[i] = k ^ 0x5c;
    iKeyPad[i] = k ^ 0x36;
  }

  iKeyPad.set(message, 64);
  const innerHash = sha256Bytes(iKeyPad);
  oKeyPad.set(innerHash, 64);
  return sha256Bytes(oKeyPad);
}

const DEFAULT_PBKDF2_ITERATIONS = 10000;

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

function pbkdf2Sha256Sync(password: string, saltHex: string, iterations: number): string {
  const pwBytes = textEncoder.encode(password);
  const saltBytes = hexToBytes(saltHex);

  const initialMsg = new Uint8Array(saltBytes.length + 4);
  initialMsg.set(saltBytes);
  initialMsg[saltBytes.length + 3] = 1; // INT(1) big-endian

  let u = hmacSha256(pwBytes, initialMsg);
  const derived = new Uint8Array(u);

  for (let c = 2; c <= iterations; c++) {
    u = hmacSha256(pwBytes, u);
    for (let k = 0; k < 32; k++) {
      derived[k] ^= u[k];
    }
  }

  return bytesToHex(derived);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function generateSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    throw new Error('CSPRNG (crypto.getRandomValues) tidak tersedia pada lingkungan ini.');
  }
  return bytesToHex(bytes);
}

/**
 * Hash password dengan CSPRNG random salt 128-bit dan PBKDF2-HMAC-SHA256.
 * Format: $enc$v2$<iterations>$<saltHex>$<derivedHex>
 */
export function hashPassword(password: string): string {
  if (!password) return '';
  const salt = generateSaltHex(16);
  const derived = pbkdf2Sha256Sync(password, salt, DEFAULT_PBKDF2_ITERATIONS);
  return `$enc$v2$${DEFAULT_PBKDF2_ITERATIONS}$${salt}$${derived}`;
}

/**
 * Cek apakah password tersimpan sudah menggunakan format hash terenkripsi
 */
export function isPasswordEncrypted(stored: string): boolean {
  return Boolean(stored && stored.startsWith('$enc$v2$'));
}

/**
 * Verifikasi kecocokan password input terhadap hash PBKDF2 atau fallback plaintext lama
 */
export function verifyPassword(passwordInput: string, storedPassword: string): boolean {
  if (!passwordInput || !storedPassword) return false;

  if (storedPassword.startsWith('$enc$v2$')) {
    const parts = storedPassword.split('$');
    // parts: ['', 'enc', 'v2', iterations, salt, hash]
    if (parts.length >= 6) {
      const iterations = parseInt(parts[3], 10);
      const salt = parts[4];
      const targetHash = parts[5];
      if (!iterations || iterations < 1000 || !salt || !targetHash) return false;
      const computed = pbkdf2Sha256Sync(passwordInput, salt, iterations);
      return constantTimeEqual(computed, targetHash);
    }
    return false;
  }

  // Fallback hanya untuk migrasi record plaintext lokal lama (otomatis di-upgrade saat login)
  if (!storedPassword.startsWith('$enc$')) {
    return constantTimeEqual(storedPassword, passwordInput);
  }

  return false;
}
