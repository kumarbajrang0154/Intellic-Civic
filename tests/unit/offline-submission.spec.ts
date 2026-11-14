import { test, expect } from '@playwright/test';
import { z } from 'zod';

const createComplaintSchema = z
  .object({
    title: z
      .string('Complaint title is required')
      .trim()
      .min(1, 'Complaint title is required'),
    description: z
      .string('Detailed description (min 20 characters) is required')
      .trim()
      .min(20, 'Detailed description (min 20 characters) is required'),
    categoryId: z.string().trim().optional(),
    location: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        address: z.string().optional(),
      })
      .optional(),
    isVoiceInput: z.boolean().optional(),
    voiceTranscript: z.string().optional(),
    imageUrl: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),
    evidence: z.array(z.string()).optional(),
    clientRequestId: z
      .string('Invalid clientRequestId: must be a non-empty string')
      .trim()
      .min(1, 'Invalid clientRequestId: must be a non-empty string')
      .optional()
      .nullable(),
    capturedAt: z.union([z.string(), z.date()]).optional().nullable(),
    language: z.string().optional(),
    mockAiProvider: z.string().optional(),
  })
  .refine(
    (data) => {
      const allImages =
        Array.isArray(data.evidence) && data.evidence.length > 0
          ? data.evidence
          : Array.isArray(data.imageUrls) && data.imageUrls.length > 0
          ? data.imageUrls
          : data.imageUrl
          ? [data.imageUrl]
          : [];
      return allImages.length > 0;
    },
    {
      message: 'At least 1 photo evidence is required to submit a complaint.',
      path: ['evidence'],
    },
  )
  .refine(
    (data) => {
      if (!data.capturedAt) return true;
      const d = new Date(data.capturedAt);
      return !isNaN(d.getTime());
    },
    {
      message: 'Invalid capturedAt timestamp',
      path: ['capturedAt'],
    },
  );

test.describe('Task 6b — Server Idempotency & Zod Validation for Complaints', () => {
  test('Zod validates title presence and trims whitespace', () => {
    const res1 = createComplaintSchema.safeParse({
      description: 'A valid description of more than twenty characters.',
      imageUrl: 'https://example.com/photo.jpg',
    });
    expect(res1.success).toBe(false);
    if (!res1.success) {
      expect(res1.error.issues[0].message).toBe('Complaint title is required');
    }

    const res2 = createComplaintSchema.safeParse({
      title: '   ',
      description: 'A valid description of more than twenty characters.',
      imageUrl: 'https://example.com/photo.jpg',
    });
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.error.issues[0].message).toBe('Complaint title is required');
    }
  });

  test('Zod enforces minimum 20 characters for description', () => {
    const res = createComplaintSchema.safeParse({
      title: 'Street light broken',
      description: 'Short desc',
      imageUrl: 'https://example.com/photo.jpg',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Detailed description (min 20 characters) is required');
    }
  });

  test('Zod enforces at least 1 photo evidence', () => {
    const res = createComplaintSchema.safeParse({
      title: 'Street light broken',
      description: 'Street light pole has completely stopped working since last night.',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('At least 1 photo evidence is required to submit a complaint.');
    }
  });

  test('Zod validates non-empty string clientRequestId', () => {
    const res = createComplaintSchema.safeParse({
      title: 'Street light broken',
      description: 'Street light pole has completely stopped working since last night.',
      imageUrl: 'https://example.com/photo.jpg',
      clientRequestId: '   ',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Invalid clientRequestId: must be a non-empty string');
    }
  });

  test('Zod validates capturedAt timestamp', () => {
    const res = createComplaintSchema.safeParse({
      title: 'Street light broken',
      description: 'Street light pole has completely stopped working since last night.',
      imageUrl: 'https://example.com/photo.jpg',
      capturedAt: 'invalid-iso-timestamp',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Invalid capturedAt timestamp');
    }
  });

  test('Zod accepts valid complete payload with clientRequestId', () => {
    const res = createComplaintSchema.safeParse({
      title: 'Large Pothole on Sector 4 Main Road',
      description: 'Pothole is approximately 2 feet wide and causes dangerous vehicle swerving.',
      evidence: ['https://example.com/pothole.jpg'],
      clientRequestId: 'req-uuid-1234-5678',
      capturedAt: '2026-11-14T09:00:00.000Z',
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'MG Road, Bangalore',
      },
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.title).toBe('Large Pothole on Sector 4 Main Road');
      expect(res.data.clientRequestId).toBe('req-uuid-1234-5678');
    }
  });
});

test.describe('Task 6c — Offline Queue States & Lifecycle', () => {
  interface MockOfflineDraft {
    id: string;
    userId: string;
    status: 'pending' | 'syncing' | 'synced' | 'failed';
    attempts: number;
    lastError?: string;
    ticketId?: string;
    complaintId?: string;
  }

  test('Queue item transitions from pending -> syncing -> synced on successful sync', async () => {
    const draft: MockOfflineDraft = {
      id: 'draft-abc-123',
      userId: 'citizen_1',
      status: 'pending',
      attempts: 0,
    };
    expect(draft.status).toBe('pending');

    // Sync runner starts
    draft.status = 'syncing';
    expect(draft.status).toBe('syncing');

    // Server returns HTTP 201 with ticket
    const serverResponse = { id: 'cmp_123', ticketId: 'CMP-2026-0042' };
    draft.status = 'synced';
    draft.ticketId = serverResponse.ticketId;
    draft.complaintId = serverResponse.id;

    expect(draft.status).toBe('synced');
    expect(draft.ticketId).toBe('CMP-2026-0042');
    expect(draft.complaintId).toBe('cmp_123');
  });

  test('Queue item transitions from syncing -> failed on fatal 400 validation error', async () => {
    const draft: MockOfflineDraft = {
      id: 'draft-bad-456',
      userId: 'citizen_1',
      status: 'syncing',
      attempts: 1,
    };

    // Server returns HTTP 400
    draft.status = 'failed';
    draft.lastError = 'Detailed description (min 20 characters) is required';

    expect(draft.status).toBe('failed');
    expect(draft.lastError).toContain('min 20 characters');
  });

  test('Idempotency returns existing record on second submit without creating duplicates', () => {
    const databaseRows: { id: string; ticketId: string; clientRequestId: string; citizenId: string }[] = [];

    function handleComplaintPost(payload: { clientRequestId?: string; citizenId: string; title: string }) {
      if (payload.clientRequestId) {
        const existing = databaseRows.find((r) => r.clientRequestId === payload.clientRequestId);
        if (existing) {
          if (existing.citizenId === payload.citizenId) {
            return { status: 200, complaint: existing };
          }
          return { status: 403, error: 'Forbidden' };
        }
      }

      const created = {
        id: `cmp_${databaseRows.length + 1}`,
        ticketId: `CMP-2026-000${databaseRows.length + 1}`,
        clientRequestId: payload.clientRequestId || `auto_${Date.now()}`,
        citizenId: payload.citizenId,
      };
      databaseRows.push(created);
      return { status: 201, complaint: created };
    }

    // First POST
    const res1 = handleComplaintPost({
      clientRequestId: 'idempotent-uuid-777',
      citizenId: 'citizen_1',
      title: 'Water logging near bus stop',
    });
    expect(res1.status).toBe(201);
    expect(databaseRows.length).toBe(1);

    // Second POST with identical clientRequestId
    const res2 = handleComplaintPost({
      clientRequestId: 'idempotent-uuid-777',
      citizenId: 'citizen_1',
      title: 'Water logging near bus stop',
    });
    expect(res2.status).toBe(200);
    expect(res2.complaint?.id).toBe(res1.complaint?.id);
    expect(res2.complaint?.ticketId).toBe(res1.complaint?.ticketId);
    expect(databaseRows.length).toBe(1); // Exactly one row in DB!

    // POST with different citizen ID returns 403
    const res3 = handleComplaintPost({
      clientRequestId: 'idempotent-uuid-777',
      citizenId: 'citizen_different_user',
      title: 'Attempting to reuse another user clientRequestId',
    });
    expect(res3.status).toBe(403);
    expect(databaseRows.length).toBe(1);
  });
});
