/**
 * AES-256-CBC Decryption Utility
 * 
 * Decrypts encrypted GLB model files using Web Crypto API.
 * Used to protect 3D model assets.
 */

// Default encryption key (32 bytes for AES-256)
const DEFAULT_KEY = 'ai-interviewer-pro-max-key-2024!';

/**
 * Decrypt an AES-256-CBC encrypted file
 * @param {ArrayBuffer} encryptedData - The encrypted data buffer
 * @param {string} keyString - The encryption key (32 characters)
 * @returns {Promise<ArrayBuffer>} - The decrypted data
 */
export async function decryptFile(encryptedData, keyString = DEFAULT_KEY) {
    try {
        // First 16 bytes are the IV
        const iv = new Uint8Array(encryptedData.slice(0, 16));
        const data = new Uint8Array(encryptedData.slice(16));

        // Convert key string to bytes
        const encoder = new TextEncoder();
        const keyBytes = encoder.encode(keyString.padEnd(32, '0').slice(0, 32));

        // Import key
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'AES-CBC' },
            false,
            ['decrypt']
        );

        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv },
            cryptoKey,
            data
        );

        return decrypted;
    } catch (error) {
        console.error('[Decrypt] Failed to decrypt file:', error);
        throw error;
    }
}

/**
 * Load and decrypt an encrypted GLB file
 * @param {string} url - URL to the encrypted file
 * @param {string} key - Encryption key
 * @returns {Promise<ArrayBuffer>} - Decrypted GLB data
 */
export async function loadEncryptedModel(url, key = DEFAULT_KEY) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load encrypted model: ${response.status}`);
    }

    const encryptedData = await response.arrayBuffer();
    return decryptFile(encryptedData, key);
}

/**
 * Create a Blob URL from decrypted ArrayBuffer
 * @param {ArrayBuffer} data - The decrypted data
 * @param {string} mimeType - The MIME type
 * @returns {string} - Blob URL
 */
export function createBlobUrl(data, mimeType = 'model/gltf-binary') {
    const blob = new Blob([data], { type: mimeType });
    return URL.createObjectURL(blob);
}

export default {
    decryptFile,
    loadEncryptedModel,
    createBlobUrl,
};
