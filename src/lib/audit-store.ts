import prisma from '@/lib/prisma';

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

function formatAuditEntry(log: any): AuditEntry {
  const meta = (log.metadata as Record<string, any>) || {};
  return {
    id: log.id,
    actorId: log.userId || meta.actorId || 'system',
    actorName: meta.actorName || 'System User',
    action: log.action,
    entityType: log.entityType,
    targetId: log.entityId || meta.targetId || null,
    targetName: meta.targetName || null,
    metadata: meta,
    createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : new Date(log.createdAt || Date.now()).toISOString(),
  };
}

export async function addAuditLog(entry: Omit<AuditEntry, 'id' | 'createdAt'>): Promise<AuditEntry> {
  const metadata = {
    actorName: entry.actorName,
    targetName: entry.targetName,
    ...(entry.metadata || {}),
  };

  const newLog = await prisma.auditLog.create({
    data: {
      userId: entry.actorId !== 'system' ? entry.actorId : undefined,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.targetId || undefined,
      metadata,
    },
  });

  return formatAuditEntry(newLog);
}

export async function listAuditLogs(filters?: {
  actorId?: string;
  targetId?: string;
  actions?: string[];
  entityType?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  const where: any = {};

  if (filters?.actorId) {
    where.userId = filters.actorId;
  }
  if (filters?.targetId) {
    where.entityId = filters.targetId;
  }
  if (filters?.actions && filters.actions.length > 0) {
    where.action = { in: filters.actions };
  }
  if (filters?.entityType) {
    where.entityType = filters.entityType;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters?.limit || 100,
  });

  return logs.map(formatAuditEntry);
}
