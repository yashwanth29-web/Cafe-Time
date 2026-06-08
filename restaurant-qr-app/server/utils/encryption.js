const crypto = require('crypto');

// Ensure key is exactly 32 bytes (256 bits) using SHA-256 digest hashing
const getEncryptionKey = () => {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    return crypto.createHash('sha256').update(envKey).digest();
  }
  // Fallback key linked to JWT secret
  const jwtSecret = process.env.JWT_SECRET || 'super_secret_cafe_key_12345';
  return crypto.createHash('sha256').update(jwtSecret).digest();
};

const IV_LENGTH = 16; // AES block size

/**
 * Encrypt plain text using AES-256-CBC
 */
const encrypt = (text) => {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Prepend iv so decryption has access to it
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption utility error:', error.message);
    return '';
  }
};

/**
 * Decrypt cipher text using AES-256-CBC
 */
const decrypt = (text) => {
  if (!text) return '';
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return '';
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption utility error:', error.message);
    return '';
  }
};

module.exports = { encrypt, decrypt };
