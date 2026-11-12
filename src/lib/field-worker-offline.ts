'use client';

/**
 * field-worker-offline.ts — Dedicated IndexedDB queue for Field Worker offline operations
 * (Start Work, Evidence Upload, Submit for Review) with automatic sync when back online.
 */

export interface FieldWorkerOfflineAction {
  idempotencyKey: string;
  userId: string;
  complaintId: string;
  ticketId?: string;
  actionType: 'START_WORK' | 'UPLOAD_EVIDENCE' | 'SUBMIT_FOR_REVIEW';
  stage?: 'BEFORE' | 'DURING' | 'AFTER';
  imageUrl?: string;
  notes?: string;
  remarks?: string;
  capturedAt: string;
  status: 'pending' | 'failed';
  lastError?: string;
}

const FW_DB_NAME = 'intellicivic_fw_offline_db';
const FW_DB_VERSION = 1;
const FW_STORE_NAME = 'fw_actions';
const SYNC_CHANGE_EVENT = 'ic-fw-offline-queue-change';

function openFwDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB unavailable'));
    }
    const req = window.indexedDB.open(FW_DB_NAME, FW_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(FW_STORE_NAME)) {
        const store = db.createObjectStore(FW_STORE_NAME, { keyPath: 'idempotencyKey' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

function notifyQueueChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_CHANGE_EVENT));
  }
}

export async function enqueueFieldWorkerAction(
  action: Omit<FieldWorkerOfflineAction, 'status' | 'capturedAt'> & { capturedAt?: string },
): Promise<FieldWorkerOfflineAction> {
  const db = await openFwDatabase();
  const entry: FieldWorkerOfflineAction = {
    ...action,
    capturedAt: action.capturedAt || new Date().toISOString(),
    status: 'pending',
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FW_STORE_NAME, 'readwrite');
    tx.objectStore(FW_STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  notifyQueueChange();
  return entry;
}

export async function listFieldWorkerOfflineActions(
  userId?: string,
): Promise<FieldWorkerOfflineAction[]> {
  if (typeof window === 'undefined' || !window.indexedDB) return [];
  const db = await openFwDatabase();
  const items = await new Promise<FieldWorkerOfflineAction[]>((resolve, reject) => {
    const tx = db.transaction(FW_STORE_NAME, 'readonly');
    const req = tx.objectStore(FW_STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as FieldWorkerOfflineAction[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items
    .filter((i) => !userId || i.userId === userId)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export async function removeFieldWorkerOfflineAction(idempotencyKey: string): Promise<void> {
  const db = await openFwDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FW_STORE_NAME, 'readwrite');
    tx.objectStore(FW_STORE_NAME).delete(idempotencyKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  notifyQueueChange();
}

export async function syncFieldWorkerOfflineActions(
  userId?: string,
): Promise<{ synced: number; failed: number; remaining: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const pending = await listFieldWorkerOfflineActions(userId);
    return { synced: 0, failed: 0, remaining: pending.length };
  }

  const actions = await listFieldWorkerOfflineActions(userId);
  if (actions.length === 0) {
    return { synced: 0, failed: 0, remaining: 0 };
  }

  const batch = actions.slice(0, 20).map((a) => {
    if (a.actionType === 'START_WORK') {
      return {
        idempotencyKey: a.idempotencyKey,
        actionType: 'START_WORK' as const,
        complaintId: a.complaintId,
        capturedAt: a.capturedAt,
      };
    }
    if (a.actionType === 'UPLOAD_EVIDENCE') {
      return {
        idempotencyKey: a.idempotencyKey,
        actionType: 'UPLOAD_EVIDENCE' as const,
        complaintId: a.complaintId,
        stage: a.stage || 'DURING',
        imageUrl: a.imageUrl || '',
        notes: a.notes,
        capturedAt: a.capturedAt,
      };
    }
    return {
      idempotencyKey: a.idempotencyKey,
      actionType: 'SUBMIT_FOR_REVIEW' as const,
      complaintId: a.complaintId,
      remarks: a.remarks || 'Completed offline inspection',
      capturedAt: a.capturedAt,
    };
  });

  const res = await fetch('/api/field-worker/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actions: batch }),
  });

  if (!res.ok) {
    return { synced: 0, failed: batch.length, remaining: actions.length };
  }

  const data = await res.json();
  let synced = 0;
  let failed = 0;

  for (const r of data.results || []) {
    if (r.ok || r.status === 400 || r.status === 404) {
      await removeFieldWorkerOfflineAction(r.idempotencyKey);
      if (r.ok) synced += 1;
      else failed += 1;
    } else {
      failed += 1;
    }
  }

  const after = await listFieldWorkerOfflineActions(userId);
  notifyQueueChange();
  return { synced, failed, remaining: after.length };
}

export function onFieldWorkerQueueChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SYNC_CHANGE_EVENT, handler);
  return () => window.removeEventListener(SYNC_CHANGE_EVENT, handler);
}

