const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function resolveKey() {
  if (env.encryptionKey && /^[0-9a-fA-F]{64}$/.test(env.encryptionKey)) {
    return Buffer.from(env.encryptionKey, 'hex');
  }
  if (env.encryptionKey && env.encryptionKey.length >= 32) {
    return crypto.createHash('sha256').update(env.encryptionKey, 'utf8').digest();
  }
  if (env.nodeEnv !== 'production' && env.jwtSecret) {
    return crypto.createHash('sha256').update(`enc:${env.jwtSecret}`).digest();
  }
  throw new Error(
    'ENCRYPTION_KEY must be set for encryptData/decryptData (64 hex chars or a 32+ character secret). In development only, a key is derived from JWT_SECRET if ENCRYPTION_KEY is unset.',
  );
}

/**
 * Encrypts a UTF-8 string; returns base64url payload (iv + authTag + ciphertext).
 * @param {string} plainText
 * @returns {string}
 */
function encryptData(plainText) {
  if (typeof plainText !== 'string') {
    throw new TypeError('encryptData expects a string');
  }
  const key = resolveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/**
 * Decrypts output from encryptData.
 * @param {string} payload base64url
 * @returns {string}
 */
function decryptData(payload) {
  if (typeof payload !== 'string' || !payload) {
    throw new TypeError('decryptData expects a non-empty string');
  }
  const key = resolveKey();
  const data = Buffer.from(payload, 'base64url');
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

module.exports = {
  encryptData,
  decryptData,
};
