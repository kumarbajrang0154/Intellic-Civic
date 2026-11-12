import crypto from 'node:crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { extractWardLabel } from '@/services/transparency-service';

export const publicApiComplaintsQuerySchema = z.object({
  status: z
    .enum([
      'SUBMITTED',
      'PENDING_DEPT_REVIEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
    ])
    .optional(),
  category: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface PublicApiComplaintItem {
  ticketId: string;
  category: string;
  department: string;
  status: string;
  priority: string | null;
  ward: string;
  approxLat: number | null;
  approxLng: number | null;
  voteCount: number;
  createdAt: string;
}

/**
 * Coarse 2-decimal rounding (~1.1km grid) ensures no exact residential address/coordinate exposure.
 */
function coarsenCoord(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

export function verifyOptionalPublicApiKey(
  providedKey: string | null,
  expectedKey: string | undefined = process.env.PUBLIC_API_KEY,
): { authorized: boolean; mode: 'open' | 'api_key' } {
  const configured = expectedKey?.trim();
  if (!configured) {
    // Public civic transparency feed stays accessible in open mode unless PUBLIC_API_KEY is configured.
    return { authorized: true, mode: 'open' };
  }
  if (!providedKey || !providedKey.trim()) {
    return { authorized: false, mode: 'api_key' };
  }
  const a = Buffer.from(providedKey.trim(), 'utf8');
  const b = Buffer.from(configured, 'utf8');
  if (a.length !== b.length) {
    return { authorized: false, mode: 'api_key' };
  }
  return { authorized: crypto.timingSafeEqual(a, b), mode: 'api_key' };
}

export interface PublicApiDbClient {
  complaint: {
    findMany: (args: any) => Promise<any[]>;
    count: (args?: any) => Promise<number>;
  };
}

export async function listPublicCivicComplaints(
  query: z.infer<typeof publicApiComplaintsQuerySchema>,
  db: PublicApiDbClient = prisma as unknown as PublicApiDbClient,
): Promise<PublicApiComplaintItem[]> {
  const where: any = {};
  if (query.status) {
    where.status = query.status;
  }
  if (query.category) {
    where.category = { name: { contains: query.category, mode: 'insensitive' } };
  }

  const rows = await db.complaint.findMany({
    where,
    select: {
      ticketId: true,
      status: true,
      priority: true,
      voteCount: true,
      createdAt: true,
      category: { select: { name: true } },
      department: { select: { name: true } },
      municipality: { select: { name: true, city: true, state: true } },
      location: { select: { address: true, latitude: true, longitude: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });

  return rows.map((r) => ({
    ticketId: r.ticketId,
    category: r.category?.name ?? 'General',
    department: r.department?.name ?? 'Triage',
    status: r.status,
    priority: r.priority ?? null,
    ward: extractWardLabel(r.location?.address, r.municipality),
    approxLat: coarsenCoord(r.location?.latitude),
    approxLng: coarsenCoord(r.location?.longitude),
    voteCount: Number(r.voteCount ?? 0),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
  }));
}

export function buildPublicOpenApiSpec(baseUrl: string = 'https://smartaicity.vercel.app') {
  return {
    openapi: '3.0.3',
    info: {
      title: 'IntelliCivic Public Civic API',
      version: '1.0.0',
      description:
        'Read-only anonymized municipal complaint feed, transparency metrics, and platform health endpoints.',
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/api/health': {
        get: {
          summary: 'Platform readiness & uptime health check',
          responses: {
            '200': { description: 'Database and core services are reachable' },
            '503': { description: 'Database unreachable' },
          },
        },
      },
      '/api/public/v1/complaints': {
        get: {
          summary: 'List anonymized civic complaints',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } },
          ],
          responses: {
            '200': { description: 'Anonymized complaint feed (no citizen PII)' },
            '401': { description: 'Missing or invalid X-API-Key when enforced' },
          },
        },
      },
      '/api/public/v1/stats': {
        get: {
          summary: 'Public municipal resolution statistics',
          responses: {
            '200': { description: 'Aggregate complaint counts by status' },
          },
        },
      },
      '/api/public/transparency': {
        get: {
          summary: 'Ward and department transparency aggregates',
          responses: {
            '200': { description: 'Aggregate counts by department and ward' },
          },
        },
      },
    },
  };
}

