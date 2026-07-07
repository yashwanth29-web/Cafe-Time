const crypto = require('crypto');

// Algorithm and settings
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Gets the encryption key from environment variables or throws an error.
 * Falls back to a deterministic key generated from JWT_SECRET if ENCRYPTION_KEY is not set.
 */
const getEncryptionKey = () => {
  if (process.env.ENCRYPTION_KEY) {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    if (key.length === KEY_LENGTH) return key;
  }
  
  if (process.env.JWT_SECRET) {
    // Generate a 32-byte key from JWT_SECRET to use as a fallback
    return crypto.scryptSync(process.env.JWT_SECRET, 'salt', KEY_LENGTH);
  }

  throw new Error('Missing ENCRYPTION_KEY or JWT_SECRET in environment variables.');
};

/**
 * Encrypts a string using AES-256-GCM.
 * @param {string} text - The plaintext string to encrypt.
 * @returns {string} The encrypted string in format: iv:salt:tag:encryptedText
 */
const encrypt = (text) => {
  if (!text) return '';

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: TAG_LENGTH
    });

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    // Format: iv:salt:tag:encryptedText
    return `${iv.toString('hex')}:${salt.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt sensitive data.');
  }
};

/**
 * Decrypts a string that was encrypted using AES-256-GCM.
 * @param {string} encryptedText - The formatted encrypted string (iv:salt:tag:encryptedText).
 * @returns {string} The decrypted plaintext string.
 */
const decrypt = (encryptedText) => {
  if (!encryptedText) return '';

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted format.');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const salt = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const text = parts[3];

    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: TAG_LENGTH
    });
    
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt sensitive data.');
  }
};

module.exports = {
  encrypt,
  decrypt
};
