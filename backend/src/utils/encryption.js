"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptData = encryptData;
exports.decryptData = decryptData;
exports.hashSearchableData = hashSearchableData;
const crypto_1 = __importDefault(require("crypto"));
// The key should be 32 bytes for AES-256
// In a real application, this should be stored securely in an environment variable.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 characters
const IV_LENGTH = 16; // For AES, this is always 16
/**
 * Encrypts a text string using AES-256-CBC
 */
function encryptData(text) {
    if (!text)
        return text;
    let iv = crypto_1.default.randomBytes(IV_LENGTH);
    let cipher = crypto_1.default.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}
/**
 * Decrypts an AES-256-CBC encrypted string
 */
function decryptData(text) {
    if (!text)
        return null;
    try {
        let textParts = text.split(':');
        let iv = Buffer.from(textParts.shift(), 'hex');
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');
        let decipher = crypto_1.default.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
    catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}
/**
 * Deterministically hashes a string (like a phone number) for searching
 * Uses SHA-256 so the same phone number always produces the same hash.
 */
function hashSearchableData(text) {
    if (!text)
        return text;
    return crypto_1.default.createHash('sha256').update(text).digest('hex');
}
