/**
 * Cryptographic Utility for Absenku
 * Provides secure password hashing (with salt & multi-round SHA-256)
 * and reversible encryption for sensitive personal employee data (NIK, Bank Account, etc.)
 */

// Pure TypeScript SHA-256 Implementation (Synchronous, zero-dependency, works in all environments)
function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';

  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] = (words[i >> 2] || 0) | ((j & 255) << ((3 - (i % 4)) * 8));
  }

  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = i < 16 ? w[i] : (w[i] =
        (w[i - 16] +
          (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
          w[i - 7] +
          (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
        0);

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 =
        (hash[7] +
          (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
          ch +
          k[i] +
          s0) |
        0;

      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 =
        ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) |
        0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  let result = '';
  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

const SECRET_SALT = 'absenku_secure_salt_2026_@indiekraf';

// Generate random hex salt
function generateSalt(length = 16): string {
  const chars = 'abcdef0123456789';
  let salt = '';
  for (let i = 0; i < length; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * Hash a password securely with salt and multiple SHA-256 rounds
 * Returns format: $enc$v1$<salt>$<hash>
 */
export function hashPassword(password: string): string {
  if (!password) return '';
  const salt = generateSalt(16);
  let hash = password;
  // Multi-round hashing with salt
  for (let i = 0; i < 5; i++) {
    hash = sha256Sync(`${salt}:${hash}:${SECRET_SALT}`);
  }
  return `$enc$v1$${salt}$${hash}`;
}

/**
 * Check if a stored password is in the encrypted format
 */
export function isPasswordEncrypted(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith('$enc$v1$');
}

/**
 * Verify a plain input password against a stored password (encrypted or plaintext for legacy migration)
 */
export function verifyPassword(passwordInput: string, storedPassword?: string): boolean {
  if (!storedPassword || !passwordInput) return false;

  // 1. If stored password is in encrypted format $enc$v1$<salt>$<hash>
  if (isPasswordEncrypted(storedPassword)) {
    const parts = storedPassword.split('$');
    // parts: ['', 'enc', 'v1', salt, hash]
    if (parts.length >= 5) {
      const salt = parts[3];
      const targetHash = parts[4];
      let hash = passwordInput;
      for (let i = 0; i < 5; i++) {
        hash = sha256Sync(`${salt}:${hash}:${SECRET_SALT}`);
      }
      return hash === targetHash;
    }
  }

  // 2. Legacy fallback for old plaintext passwords (will be migrated to hash automatically)
  return storedPassword === passwordInput;
}

/**
 * Reversible Encryption for sensitive personal data (NIK, Rekening Bank, Emergency Phone)
 * Uses key-based XOR stream cipher encoded in Hex format: $sec$v1$<hex>
 */
export function encryptSensitive(text: string): string {
  if (!text) return text;
  if (text.startsWith('$sec$v1$')) return text; // Already encrypted

  const key = `${SECRET_SALT}_vault_key`;
  let hex = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    const xor = charCode ^ keyChar;
    hex += xor.toString(16).padStart(4, '0');
  }
  return `$sec$v1$${hex}`;
}

/**
 * Decrypt sensitive personal data
 */
export function decryptSensitive(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.startsWith('$sec$v1$')) return ciphertext; // Not encrypted

  try {
    const hex = ciphertext.replace('$sec$v1$', '');
    const key = `${SECRET_SALT}_vault_key`;
    let result = '';
    let keyIdx = 0;
    for (let i = 0; i < hex.length; i += 4) {
      const chunk = hex.substr(i, 4);
      const xor = parseInt(chunk, 16);
      const keyChar = key.charCodeAt(keyIdx % key.length);
      result += String.fromCharCode(xor ^ keyChar);
      keyIdx++;
    }
    return result;
  } catch (e) {
    console.warn('Failed to decrypt sensitive data:', e);
    return ciphertext;
  }
}
