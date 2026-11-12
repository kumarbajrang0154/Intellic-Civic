import { test, expect } from '@playwright/test';
import { optimizeFieldWorkerRoute } from '@/services/route-planning-service';
import { processFieldWorkerOfflineBatch } from '@/services/field-worker-sync-service';
import { dispatchCitizenMultiChannelNotification } from '@/services/multichannel-notification-service';
import {
  assignContractorWorkOrder,
  ContractorServiceError,
  createContractor,
} from '@/services/contractor-service';
import {
  MunicipalityServiceError,
  onboardMunicipality,
} from '@/services/municipality-service';
import { checkSystemHealth } from '@/services/health-service';
import {
  buildPublicOpenApiSpec,
  listPublicCivicComplaints,
  verifyOptionalPublicApiKey,
} from '@/services/public-api-service';

test.describe('Operations, Notifications, Contractors, Municipalities, Health & Public API', () => {
  test('optimizeFieldWorkerRoute orders nearest stops, separates unmapped tasks, and builds Maps URL', () => {
    const route = optimizeFieldWorkerRoute(
      [
        {
          id: 'far',
          ticketId: 'INC-2',
          title: 'Far Stop',
          status: 'ASSIGNED',
          priority: 'LOW',
          latitude: 11.08,
          longitude: 77.05,
        },
        {
          id: 'near',
          ticketId: 'INC-1',
          title: 'Near Stop',
          status: 'ASSIGNED',
          priority: 'HIGH',
          latitude: 11.018,
          longitude: 76.956,
        },
        {
          id: 'unmapped',
          ticketId: 'INC-3',
          title: 'No GPS',
          status: 'ASSIGNED',
          priority: 'MEDIUM',
          latitude: null,
          longitude: null,
        },
      ],
      { startLat: 11.0168, startLng: 76.9558, mode: 'distance' },
    );

    expect(route.stops.map((s) => s.ticketId)).toEqual(['INC-1', 'INC-2']);
    expect(route.unmappedStops.map((s) => s.ticketId)).toEqual(['INC-3']);
    expect(route.totalDistanceKm).toBeGreaterThan(0);
    expect(route.googleMapsUrl).toContain('google.com/maps/dir');
  });

  test('processFieldWorkerOfflineBatch executes offline actions and deduplicates idempotencyKeys', async () => {
    let calls = 0;
    const summary = await processFieldWorkerOfflineBatch(
      [
        { idempotencyKey: 'k1', actionType: 'START_WORK', complaintId: 'c1' },
        { idempotencyKey: 'k1', actionType: 'START_WORK', complaintId: 'c1' },
        {
          idempotencyKey: 'k2',
          actionType: 'UPLOAD_EVIDENCE',
          complaintId: 'c1',
          stage: 'BEFORE',
          imageUrl: 'https://cdn.example.com/b.jpg',
        },
      ],
      { id: 'fw-1', name: 'Worker One' },
      {
        startWork: async () => {
          calls += 1;
          return { ok: true, status: 200, message: 'Started' };
        },
        uploadEvidence: async () => ({ ok: true, status: 201, message: 'Uploaded' }),
        submitReview: async () => ({ ok: true, status: 200, message: 'Submitted' }),
      },
    );

    expect(calls).toBe(1);
    expect(summary.total).toBe(3);
    expect(summary.succeeded).toBe(3);
    expect(summary.failed).toBe(0);
  });

  test('dispatchCitizenMultiChannelNotification hashes phone targets and skips unconfigured channels safely', async () => {
    const logs: any[] = [];
    const mockDb = {
      user: {
        findUnique: async () => ({ id: 'cit-1', mobileNumber: '+919876543210' }),
      },
      pushSubscription: {
        upsert: async () => ({}),
        updateMany: async () => ({ count: 0 }),
        findMany: async () => [],
      },
      notificationDeliveryLog: {
        create: async (args: any) => {
          logs.push(args.data);
          return {};
        },
      },
    };

    const res = await dispatchCitizenMultiChannelNotification(
      {
        userId: 'cit-1',
        complaintId: 'c-1',
        ticketId: 'INC-2026-0099',
        message: 'Crew assigned to repair streetlight',
      },
      { db: mockDb },
    );

    expect(res.results).toHaveLength(3);
    expect(logs).toHaveLength(3);
    expect(JSON.stringify(logs)).not.toContain('9876543210');
  });

  test('contractor service enforces municipality isolation and active status checks', async () => {
    const db = {
      contractor: {
        findMany: async () => [],
        findUnique: async () => ({
          id: 'cnt-1',
          name: 'Ravi',
          companyName: 'RoadFix Ltd',
          municipalityId: 'mun-2',
          isActive: false,
        }),
        create: async (args: any) => ({ id: 'cnt-new', ...args.data }),
        update: async () => ({}),
      },
      contractorWorkOrder: {
        findMany: async () => [],
        create: async (args: any) => ({ id: 'wo-1', ...args.data }),
      },
      complaint: {
        findUnique: async () => ({
          id: 'c-1',
          ticketId: 'INC-1',
          municipalityId: 'mun-1',
        }),
      },
    };

    const created = await createContractor(
      { id: 'admin-1', role: 'ADMIN', municipalityId: 'mun-1' },
      {
        name: 'A. Kumar',
        companyName: 'Civic Works Co',
        registrationCode: 'cnt-001',
        specialty: 'Road Asphalt',
      },
      db,
    );
    expect(created.registrationCode).toBe('CNT-001');
    expect(created.municipalityId).toBe('mun-1');

    await expect(
      assignContractorWorkOrder(
        'c-1',
        { id: 'admin-1', role: 'ADMIN', municipalityId: 'mun-1' },
        { contractorId: 'cnt-1', estimatedCostPaise: 50000, status: 'ASSIGNED' },
        db,
      ),
    ).rejects.toBeInstanceOf(ContractorServiceError);
  });

  test('onboardMunicipality creates tenant and maps P2002 duplicates to 409', async () => {
    const okDb = {
      municipality: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async (args: any) => ({ id: 'mun-new', ...args.data }),
        update: async () => ({}),
      },
      department: {
        create: async (args: any) => ({ id: 'dept-new', name: args.data.name }),
      },
    };

    const res = await onboardMunicipality(
      {
        name: 'Salem Corporation',
        code: 'slm-01',
        city: 'Salem',
        state: 'Tamil Nadu',
        starterDepartmentName: 'Public Works',
      },
      okDb,
    );
    expect(res.municipality.code).toBe('SLM-01');
    expect(res.starterDepartment?.name).toBe('Public Works');

    const dupDb = {
      ...okDb,
      municipality: {
        ...okDb.municipality,
        create: async () => {
          const e: any = new Error('Unique violation');
          e.code = 'P2002';
          throw e;
        },
      },
    };

    await expect(
      onboardMunicipality({ name: 'Salem', code: 'SLM', city: 'Salem', state: 'TN' }, dupDb),
    ).rejects.toBeInstanceOf(MunicipalityServiceError);
  });

  test('checkSystemHealth returns 200 healthy when DB responds and degraded without leaking env secrets when DB fails', async () => {
    const healthy = await checkSystemHealth({
      db: { $queryRawUnsafe: async () => [{ '?column?': 1 }] },
      env: { GEMINI_API_KEY: 'test-key-value' },
    });
    expect(healthy.ok).toBe(true);
    expect(healthy.checks.database.status).toBe('up');
    expect(JSON.stringify(healthy)).not.toContain('test-key-value');

    const degraded = await checkSystemHealth({
      db: {
        $queryRawUnsafe: async () => {
          throw new Error('postgres://secret:password@host/db');
        },
      },
      env: {},
    });
    expect(degraded.ok).toBe(false);
    expect(degraded.checks.database.status).toBe('down');
    expect(JSON.stringify(degraded)).not.toContain('password');
  });

  test('Public Civic API v1 validates optional API key, strips PII, coarsens coords, and emits OpenAPI spec', async () => {
    expect(verifyOptionalPublicApiKey(null, undefined)).toEqual({ authorized: true, mode: 'open' });
    expect(verifyOptionalPublicApiKey('wrong', 'secret-123')).toEqual({
      authorized: false,
      mode: 'api_key',
    });
    expect(verifyOptionalPublicApiKey('secret-123', 'secret-123')).toEqual({
      authorized: true,
      mode: 'api_key',
    });

    const items = await listPublicCivicComplaints(
      { limit: 10 },
      {
        complaint: {
          count: async () => 1,
          findMany: async () => [
            {
              ticketId: 'INC-2026-0777',
              status: 'SUBMITTED',
              priority: 'MEDIUM',
              voteCount: 4,
              createdAt: new Date('2026-11-12T00:00:00Z'),
              category: { name: 'Streetlights' },
              department: { name: 'Electrical' },
              municipality: { name: 'Coimbatore Corp', city: 'Coimbatore', state: 'Tamil Nadu' },
              location: {
                address: '42 Gandhi St, Ward 9, 9876543210',
                latitude: 11.016842,
                longitude: 76.955891,
              },
            },
          ],
        },
      },
    );

    expect(items[0].ward).toBe('Ward 9');
    expect(items[0].approxLat).toBe(11.02);
    expect(items[0].approxLng).toBe(76.96);
    expect(JSON.stringify(items)).not.toContain('9876543210');

    const spec = buildPublicOpenApiSpec();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.paths['/api/public/v1/complaints']).toBeTruthy();
  });
});

