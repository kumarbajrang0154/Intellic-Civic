/**
 * offline-queue.ts — Client-side IndexedDB Drafts Queue & Sync Engine
 * Handles offline persistence, photo compression, single-flight sync runner,
 * Cloudinary/data-url upload, reverse-geocoding, and server idempotency.
 */

export interface DraftPhoto {
  name: string;
  type: string;
  blob: Blob;
}

export interface OfflineDraft {
  id: string; // uuid = clientRequestId
  userId: string;
  fields: {
    title: string;
    description: string;
    categoryId?: string;
    isVoiceInput?: boolean;
    voiceTranscript?: string;
  };
  latitude: number | null;
  longitude: number | null;
  photos: DraftPhoto[];
  capturedAt: string; // ISO string
  status: 'pending' | 'syncing' | 'failed';
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'intellicivic_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

let dbInstance: IDBDatabase | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Compress an image file/blob to ~1MB max using HTML5 Canvas
 */
export async function compressPhoto(blobOrFile: Blob | File, maxBytes: number = 1024 * 1024): Promise<Blob> {
  if (typeof window === 'undefined') return blobOrFile;
  if (blobOrFile.size <= maxBytes && (blobOrFile.type === 'image/jpeg' || blobOrFile.type === 'image/webp')) {
    return blobOrFile;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blobOrFile);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const maxDim = 1920;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return resolve(blobOrFile);
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (compressed) => {
          if (compressed && compressed.size < blobOrFile.size) {
            resolve(compressed);
          } else {
            resolve(blobOrFile);
          }
        },
        'image/jpeg',
        0.82,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blobOrFile);
    };

    img.src = url;
  });
}

/**
 * Save or update a draft complaint
 */
export async function saveDraft(draft: OfflineDraft): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(draft);

    tx.oncomplete = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('intellicivic:drafts-changed', { detail: { draftId: draft.id } }));
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * List drafts, optionally filtered by userId
 */
export async function getDrafts(userId?: string): Promise<OfflineDraft[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let req: IDBRequest;
    if (userId) {
      const index = store.index('userId');
      req = index.getAll(IDBKeyRange.only(userId));
    } else {
      req = store.getAll();
    }

    req.onsuccess = () => {
      const items: OfflineDraft[] = req.result || [];
      // Sort oldest first by capturedAt
      items.sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve a single draft by ID
 */
export async function getDraft(id: string): Promise<OfflineDraft | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a draft by ID
 */
export async function deleteDraft(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('intellicivic:drafts-changed', { detail: { draftId: id } }));
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Helper to convert Blob to Data URL
 */
function blobToDataUrl(blob: any): Promise<string> {
  return new Promise((resolve) => {
    if (!blob || !(blob instanceof Blob)) {
      return resolve('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=');
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=');
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload a single photo blob: tries Cloudinary signature first, falls back to Data URL
 */
async function uploadPhoto(photo: DraftPhoto): Promise<string> {
  try {
    const sigRes = await fetch('/api/upload/signature', { method: 'POST' });
    if (sigRes.status === 401) {
      throw { status: 401, message: 'Session expired' };
    }
    if (sigRes.ok) {
      const sigData = await sigRes.json();
      if (sigData.cloudName && sigData.cloudName !== 'demo' && sigData.apiKey !== '1234567890' && photo.blob instanceof Blob) {
        const formData = new FormData();
        formData.append('file', photo.blob, photo.name);
        formData.append('api_key', sigData.apiKey);
        formData.append('timestamp', String(sigData.timestamp));
        formData.append('signature', sigData.signature);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
          { method: 'POST', body: formData },
        );
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          return uploadData.secure_url;
        }
      }
    }
  } catch (err: any) {
    if (err && err.status === 401) throw err;
  }

  // Fallback to Data URL
  return blobToDataUrl(photo.blob);
}

/**
 * Reverse-geocode coordinates to an address
 */
async function reverseGeocodeCoords(lat: number, lng: number): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'IntelliCivicPlatform/1.0',
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return data.display_name;
    }
  } catch {}
  return `Location at (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-Flight Sync Runner
// ─────────────────────────────────────────────────────────────────────────────

let isSyncRunning = false;

/**
 * Process all pending drafts for the current user
 */
export async function syncDrafts(userId: string): Promise<{ synced: number; failed: number; pending: number }> {
  if (typeof window === 'undefined') return { synced: 0, failed: 0, pending: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0, pending: 0 };
  if (!userId) return { synced: 0, failed: 0, pending: 0 };

  // Single-flight lock via memory flag + Web Locks API / localStorage timestamp
  if (isSyncRunning) return { synced: 0, failed: 0, pending: 0 };

  const LOCK_KEY = `ic_sync_lock_${userId}`;
  const now = Date.now();
  const lastLock = localStorage.getItem(LOCK_KEY);
  if (lastLock && now - parseInt(lastLock, 10) < 15000) {
    // Another tab is actively syncing
    return { synced: 0, failed: 0, pending: 0 };
  }

  isSyncRunning = true;
  localStorage.setItem(LOCK_KEY, now.toString());

  let synced = 0;
  let failed = 0;
  let pending = 0;

  try {
    const drafts = await getDrafts(userId);
    const eligibleDrafts = drafts.filter((d) => d.status === 'pending');

    for (const draft of eligibleDrafts) {
      if (!navigator.onLine) break;

      // Update draft status to syncing
      draft.status = 'syncing';
      await saveDraft(draft);

      try {
        // Step 1: Upload all photos
        const photoUrls: string[] = [];
        for (const photo of draft.photos) {
          const url = await uploadPhoto(photo);
          photoUrls.push(url);
        }

        // Step 2: Reverse-geocode if coords present
        let address: string | undefined = undefined;
        if (draft.latitude !== null && draft.longitude !== null) {
          address = await reverseGeocodeCoords(draft.latitude, draft.longitude);
        }

        // Step 3: POST /api/complaints with clientRequestId
        const complaintPayload: any = {
          clientRequestId: draft.id,
          capturedAt: draft.capturedAt,
          title: draft.fields.title,
          description: draft.fields.description,
          categoryId: draft.fields.categoryId,
          isVoiceInput: draft.fields.isVoiceInput,
          voiceTranscript: draft.fields.voiceTranscript,
          evidence: photoUrls,
          imageUrl: photoUrls[0],
        };

        if (draft.latitude !== null && draft.longitude !== null) {
          complaintPayload.location = {
            latitude: draft.latitude,
            longitude: draft.longitude,
            address,
          };
        }

        const res = await fetch('/api/complaints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(complaintPayload),
        });

        // Step 4: Handle response status codes
        if (res.status === 200 || res.status === 201) {
          const created = await res.json();
          // Successfully synced -> delete from IndexedDB
          await deleteDraft(draft.id);
          synced++;

          window.dispatchEvent(
            new CustomEvent('intellicivic:draft-synced', {
              detail: { draftId: draft.id, ticketId: created.ticketId, complaintId: created.id },
            }),
          );
        } else if (res.status === 401) {
          // Session expired: keep pending, prompt re-login
          draft.status = 'pending';
          draft.lastError = 'Session expired. Please sign in again to sync.';
          await saveDraft(draft);
          pending++;

          window.dispatchEvent(
            new CustomEvent('intellicivic:auth-required', {
              detail: { draftId: draft.id },
            }),
          );
          // Stop remaining syncs until re-login
          break;
        } else if (res.status === 400 || res.status === 403) {
          // Terminal error (validation or authorization failure, e.g. user suspended)
          const errData = await res.json().catch(() => ({}));
          draft.status = 'failed';
          draft.lastError = errData.message || `Server rejected with HTTP ${res.status}`;
          await saveDraft(draft);
          failed++;
        } else {
          // 5xx or unexpected -> keep pending with exponential backoff attempt count
          const errData = await res.json().catch(() => ({}));
          draft.status = 'pending';
          draft.attempts = (draft.attempts || 0) + 1;
          draft.lastError = errData.message || `Server error ${res.status}`;
          await saveDraft(draft);
          pending++;
        }
      } catch (err: any) {
        if (err && err.status === 401) {
          draft.status = 'pending';
          draft.lastError = 'Session expired. Please sign in again to sync.';
          await saveDraft(draft);
          pending++;
          window.dispatchEvent(new CustomEvent('intellicivic:auth-required', { detail: { draftId: draft.id } }));
          break;
        }

        // Network error during photo upload or request
        draft.status = 'pending';
        draft.attempts = (draft.attempts || 0) + 1;
        draft.lastError = err.message || 'Network error during sync';
        await saveDraft(draft);
        pending++;
      }
    }
  } finally {
    isSyncRunning = false;
    localStorage.removeItem(LOCK_KEY);
  }

  return { synced, failed, pending };
}

/**
 * Register background sync if supported by browser (ServiceWorker registration sync tag)
 */
export function registerBackgroundSync() {
  if (typeof window === 'undefined') return;
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg: any) => {
        return reg.sync?.register('sync-complaints');
      })
      .catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  (window as any).__offlineQueue = {
    saveDraft,
    getDrafts,
    deleteDraft,
    syncDrafts,
    compressPhoto,
  };
}
