import fs from 'fs';
import path from 'path';

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  targetId: string | null;
  targetName: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

const AUDIT_FILE_PATH = path.join(process.cwd(), '.audit_store.json');

interface AuditStoreData {
  entries: AuditEntry[];
}

function loadAuditFromDisk(): AuditStoreData {
  try {
    if (fs.existsSync(AUDIT_FILE_PATH)) {
      const raw = fs.readFileSync(AUDIT_FILE_PATH, 'utf-8');
      const json = JSON.parse(raw);
      if (json && Array.isArray(json.entries)) return json;
    }
  } catch (err) {
    console.error('Error loading audit store from disk:', err);
  }
  return { entries: [] };
}

function saveAuditToDisk(data: AuditStoreData) {
  try {
    fs.writeFileSync(AUDIT_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving audit store to disk:', err);
  }
}

const globalForAudit = global as unknown as { auditStore: AuditStoreData };

export const auditStore = globalForAudit.auditStore || loadAuditFromDisk();

if (process.env.NODE_ENV !== 'production') {
  globalForAudit.auditStore = auditStore;
}

export function addAuditLog(entry: Omit<AuditEntry, 'id' | 'createdAt'>): AuditEntry {
  const newEntry: AuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    ...entry,
    createdAt: new Date().toISOString(),
  };
  auditStore.entries.push(newEntry);
  // Keep only last 10,000 entries to avoid unbounded growth
  if (auditStore.entries.length > 10_000) {
    auditStore.entries = auditStore.entries.slice(-10_000);
  }
  saveAuditToDisk(auditStore);
  return newEntry;
}

export function listAuditLogs(filters?: {
  actorId?: string;
  targetId?: string;
  actions?: string[];
  entityType?: string;
  limit?: number;
}): AuditEntry[] {
  let list = [...auditStore.entries].reverse(); // Most recent first

  if (filters?.actorId) {
    list = list.filter((e) => e.actorId === filters.actorId);
  }
  if (filters?.targetId) {
    list = list.filter((e) => e.targetId === filters.targetId);
  }
  if (filters?.actions && filters.actions.length > 0) {
    list = list.filter((e) => filters.actions!.includes(e.action));
  }
  if (filters?.entityType) {
    list = list.filter((e) => e.entityType === filters.entityType);
  }
  if (filters?.limit) {
    list = list.slice(0, filters.limit);
  }

  return list;
}
