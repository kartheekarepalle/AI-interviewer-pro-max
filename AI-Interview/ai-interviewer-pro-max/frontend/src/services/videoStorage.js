/**
 * Video Storage Service - IndexedDB-based Video Persistence
 * 
 * Stores interview recordings in IndexedDB so they survive page navigation.
 * Blob URLs don't work across page reloads.
 */

const DB_NAME = 'InterviewVideoDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

// Open/create the database
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[VideoStorage] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
                console.log('[VideoStorage] Created object store');
            }
        };
    });
}

/**
 * Save a video blob for a session
 * @param {string} sessionId - The interview session ID
 * @param {Blob} blob - The video blob to save
 */
export async function saveVideoBlob(sessionId, blob) {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const record = {
            sessionId,
            blob,
            timestamp: Date.now(),
            mimeType: blob.type,
            size: blob.size,
        };

        return new Promise((resolve, reject) => {
            const request = store.put(record);
            request.onsuccess = () => {
                console.log(`[VideoStorage] Saved video for session ${sessionId} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
                resolve(true);
            };
            request.onerror = () => {
                console.error('[VideoStorage] Failed to save video:', request.error);
                reject(request.error);
            };
        });
    } catch (err) {
        console.error('[VideoStorage] Error saving video:', err);
        throw err;
    }
}

/**
 * Get a video blob for a session
 * @param {string} sessionId - The interview session ID
 * @returns {Promise<{blob: Blob, url: string} | null>}
 */
export async function getVideoBlob(sessionId) {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.get(sessionId);
            request.onsuccess = () => {
                const record = request.result;
                if (record && record.blob) {
                    const url = URL.createObjectURL(record.blob);
                    console.log(`[VideoStorage] Retrieved video for session ${sessionId}`);
                    resolve({
                        blob: record.blob,
                        url,
                        mimeType: record.mimeType,
                        size: record.size,
                        timestamp: record.timestamp,
                    });
                } else {
                    console.log(`[VideoStorage] No video found for session ${sessionId}`);
                    resolve(null);
                }
            };
            request.onerror = () => {
                console.error('[VideoStorage] Failed to get video:', request.error);
                reject(request.error);
            };
        });
    } catch (err) {
        console.error('[VideoStorage] Error getting video:', err);
        return null;
    }
}

/**
 * Delete a video for a session
 * @param {string} sessionId - The interview session ID
 */
export async function deleteVideoBlob(sessionId) {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.delete(sessionId);
            request.onsuccess = () => {
                console.log(`[VideoStorage] Deleted video for session ${sessionId}`);
                resolve(true);
            };
            request.onerror = () => {
                console.error('[VideoStorage] Failed to delete video:', request.error);
                reject(request.error);
            };
        });
    } catch (err) {
        console.error('[VideoStorage] Error deleting video:', err);
        throw err;
    }
}

/**
 * Check if a video exists for a session (without loading it)
 * @param {string} sessionId - The interview session ID
 */
export async function hasVideo(sessionId) {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve) => {
            const request = store.get(sessionId);
            request.onsuccess = () => {
                resolve(!!request.result);
            };
            request.onerror = () => {
                resolve(false);
            };
        });
    } catch {
        return false;
    }
}

/**
 * Clean up old videos (older than specified days)
 * @param {number} daysOld - Delete videos older than this many days (default: 7)
 */
export async function cleanupOldVideos(daysOld = 7) {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

        const request = store.openCursor();
        let deletedCount = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const record = cursor.value;
                if (record.timestamp < cutoffTime) {
                    cursor.delete();
                    deletedCount++;
                }
                cursor.continue();
            } else {
                if (deletedCount > 0) {
                    console.log(`[VideoStorage] Cleaned up ${deletedCount} old video(s)`);
                }
            }
        };
    } catch (err) {
        console.error('[VideoStorage] Error cleaning up old videos:', err);
    }
}
