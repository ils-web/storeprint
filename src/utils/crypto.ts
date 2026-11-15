/**
 * Cryptographic helpers for client-side credential hashing, verification,
 * weak-secret detection, and session token generation.
 *
 * Works both in HTTPS / localhost browsers (WebCrypto PBKDF2-HMAC-SHA256)
 * and in plain HTTP / Node environments via a deterministic pure-JS UTF-8 SHA-256 fallback.
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

function encodeUtf8(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(++i);
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function sha256Hex(input: string): string {
  const bytes = encodeUtf8(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  const h = new Uint32Array(SHA256_INIT);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += h[i].toString(16).padStart(8, '0');
  }
  return hex;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

function getRandomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < length; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

export function generateSalt(byteLength: number = 12): string {
  return bytesToHex(getRandomBytes(byteLength));
}

export function generateSessionToken(): string {
  return bytesToHex(getRandomBytes(24));
}

function hasSubtlePbkdf2(): boolean {
  try {
    const subtle = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : undefined;
    return Boolean(subtle && typeof subtle.importKey === 'function' && typeof subtle.deriveBits === 'function');
  } catch {
    return false;
  }
}

async function derivePbkdf2Hex(secret: string, salt: string, iterations: number): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const keyMaterial = await subtle.importKey(
    'raw',
    encodeUtf8(secret) as unknown as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encodeUtf8(salt) as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

export function isHashedSecret(value?: string | null): boolean {
  if (!value) return false;
  return value.startsWith('pbkdf2$') || value.startsWith('sha256$');
}

export function hashSha256Salted(plain: string, existingSalt?: string): string {
  const salt = existingSalt || generateSalt(12);
  const digest = sha256Hex(`${salt}:${plain}`);
  return `sha256$${salt}$${digest}`;
}

export async function hashSecret(plain: string): Promise<string> {
  const normalized = plain.trim();
  const salt = generateSalt(12);
  if (hasSubtlePbkdf2()) {
    try {
      const iterations = 100000;
      const digest = await derivePbkdf2Hex(normalized, salt, iterations);
      return `pbkdf2$${iterations}$${salt}$${digest}`;
    } catch {
      // Fall through to pure-JS SHA-256 salted hash
    }
  }
  return hashSha256Salted(normalized, salt);
}

export async function verifySecret(
  plainInput: string,
  storedHash?: string | null
): Promise<{ matches: boolean; needsUpgrade: boolean }> {
  if (!storedHash || typeof storedHash !== 'string') {
    return { matches: false, needsUpgrade: false };
  }

  const normalized = plainInput.trim();
  if (!normalized) {
    return { matches: false, needsUpgrade: false };
  }

  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return { matches: false, needsUpgrade: false };
    const iterations = Number(parts[1]);
    const salt = parts[2];
    const expectedHex = parts[3];
    if (!Number.isFinite(iterations) || iterations < 1000 || !salt || !expectedHex) {
      return { matches: false, needsUpgrade: false };
    }
    if (!hasSubtlePbkdf2()) {
      return { matches: false, needsUpgrade: false };
    }
    try {
      const actualHex = await derivePbkdf2Hex(normalized, salt, iterations);
      return { matches: constantTimeEqual(actualHex, expectedHex), needsUpgrade: false };
    } catch {
      return { matches: false, needsUpgrade: false };
    }
  }

  if (storedHash.startsWith('sha256$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { matches: false, needsUpgrade: false };
    const [, salt, expectedHex] = parts;
    if (!salt || !expectedHex) return { matches: false, needsUpgrade: false };
    const actualHex = sha256Hex(`${salt}:${normalized}`);
    return {
      matches: constantTimeEqual(actualHex, expectedHex),
      needsUpgrade: hasSubtlePbkdf2(),
    };
  }

  // Legacy unhashed value still stored in existing Firestore documents:
  // allow verifying once so existing deployments aren't locked out, and signal upgrade.
  const matches = constantTimeEqual(normalized, storedHash.trim());
  return { matches, needsUpgrade: matches };
}
