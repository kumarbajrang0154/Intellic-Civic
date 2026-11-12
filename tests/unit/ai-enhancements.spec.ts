import { test, expect } from '@playwright/test';
import { verifyBeforeAfterPhotosWithAi } from '@/services/ai-provider';
import {
  BeforeAfterVerificationError,
  verifyComplaintBeforeAfterPhotos,
} from '@/services/before-after-verification-service';
import { buildWardCategoryForecasts } from '@/services/predictive-analytics-service';
import {
  ComplaintTranslationError,
  translateComplaintToTargetLanguage,
} from '@/services/translation-service';
import { enqueueAiJob, processPendingAiJobs } from '@/services/ai-job-service';

test.describe('AI & Automation Enhancements (Before/After, Predictive, Translation, Jobs)', () => {
  test('verifyBeforeAfterPhotosWithAi rejects identical URLs and heuristically passes distinct URLs when unconfigured', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const same = await verifyBeforeAfterPhotosWithAi({
        beforeImageUrl: 'https://cdn.example.com/same.jpg',
        afterImageUrl: 'https://cdn.example.com/same.jpg',
        complaintTitle: 'Broken manhole',
        complaintDescription: 'Open manhole cover on main road',
        categoryName: 'Roads',
      });
      expect(same.workVerified).toBe(false);
      expect(same.provider).toBe('heuristic');

      const distinct = await verifyBeforeAfterPhotosWithAi({
        beforeImageUrl: 'https://cdn.example.com/before.jpg',
        afterImageUrl: 'https://cdn.example.com/after.jpg',
        complaintTitle: 'Broken manhole',
        complaintDescription: 'Open manhole cover on main road',
        categoryName: 'Roads',
      });
      expect(distinct.workVerified).toBe(true);
      expect(distinct.provider).toBe('heuristic');
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  test('verifyComplaintBeforeAfterPhotos uses intake fallback, enforces dept scope, and rejects missing AFTER photo', async () => {
    const mockDb = {
      complaint: {
        findUnique: async () => ({
          id: 'c-1',
          ticketId: 'INC-2026-0001',
          title: 'Pothole',
          titleEn: 'Pothole',
          description: 'Deep pothole',
          descriptionEn: 'Deep pothole',
          departmentId: 'dept-roads',
          municipalityId: 'mun-1',
          assignedOfficerId: 'off-1',
          category: { name: 'Roads' },
          images: [{ id: 'img-1', imageUrl: 'https://cdn.example.com/intake.jpg' }],
          evidence: [{ id: 'ev-after', stage: 'AFTER', imageUrl: 'https://cdn.example.com/after.jpg' }],
          assignment: { officerId: 'off-1' },
          aiPrediction: null,
        }),
      },
      aiPrediction: { update: async () => ({}) },
    };

    const res = await verifyComplaintBeforeAfterPhotos(
      'c-1',
      { id: 'off-1', name: 'Officer', role: 'OFFICER', departmentId: 'dept-roads', municipalityId: 'mun-1' },
      {
        db: mockDb,
        skipAudit: true,
        verifier: async () => ({
          workVerified: true,
          issueResolved: true,
          sameLocationLikelihood: 0.9,
          confidence: 0.88,
          summary: 'Road surface patched cleanly.',
          provider: 'gemini',
        }),
      },
    );

    expect(res.beforeSource).toBe('INTAKE_IMAGE');
    expect(res.verification.workVerified).toBe(true);

    await expect(
      verifyComplaintBeforeAfterPhotos(
        'c-1',
        { id: 'off-2', name: 'Other', role: 'OFFICER', departmentId: 'dept-water', municipalityId: 'mun-1' },
        { db: mockDb, skipAudit: true },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    const missingAfterDb = {
      complaint: {
        findUnique: async () => ({
          ...(await mockDb.complaint.findUnique()),
          evidence: [],
        }),
      },
      aiPrediction: { update: async () => ({}) },
    };

    await expect(
      verifyComplaintBeforeAfterPhotos(
        'c-1',
        { id: 'admin-1', name: 'Admin', role: 'ADMIN', municipalityId: 'mun-1' },
        { db: missingAfterDb, skipAudit: true },
      ),
    ).rejects.toBeInstanceOf(BeforeAfterVerificationError);
  });

  test('buildWardCategoryForecasts computes ward surge risk without exposing PII or coordinates', () => {
    const now = new Date('2026-11-12T00:00:00Z');
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

    const report = buildWardCategoryForecasts(
      [
        {
          id: '1',
          status: 'SUBMITTED',
          priority: 'HIGH',
          createdAt: daysAgo(3),
          category: { name: 'Drainage' },
          department: { name: 'Sanitation' },
          location: { address: '12 Main St, Ward 7, +919876543210' },
        },
        {
          id: '2',
          status: 'IN_PROGRESS',
          priority: 'CRITICAL',
          createdAt: daysAgo(7),
          category: { name: 'Drainage' },
          department: { name: 'Sanitation' },
          location: { address: 'Ward 7, Canal Road' },
        },
        {
          id: '3',
          status: 'ASSIGNED',
          priority: 'HIGH',
          createdAt: daysAgo(12),
          category: { name: 'Drainage' },
          department: { name: 'Sanitation' },
          location: { address: 'Main Road, Ward 7' },
        },
        {
          id: '4',
          status: 'RESOLVED',
          priority: 'MEDIUM',
          createdAt: daysAgo(45),
          category: { name: 'Drainage' },
          department: { name: 'Sanitation' },
          location: { address: 'Ward 7' },
        },
      ],
      { now, lookbackDays: 90, horizonDays: 30 },
    );

    expect(report.totalAnalyzed).toBe(4);
    expect(report.topSurges.length).toBe(1);
    expect(report.topSurges[0].ward).toBe('Ward 7');
    expect(report.topSurges[0].riskLevel).toBe('HIGH');
    expect(report.topSurges[0].growthRatePct).toBe(200);
    expect(JSON.stringify(report)).not.toContain('9876543210');
  });

  test('translateComplaintToTargetLanguage handles en/hi/ta and enforces citizen ownership', async () => {
    let cachedWrite: any = null;
    const db = {
      complaint: {
        findUnique: async () => ({
          id: 'c-10',
          ticketId: 'INC-2026-0010',
          citizenId: 'cit-1',
          municipalityId: 'mun-1',
          title: 'தெருவிளக்கு எரியவில்லை',
          description: 'சாலையில் விளக்கு இல்லை',
          language: 'ta',
          titleEn: 'Streetlight not working',
          descriptionEn: 'Streetlight out on main road',
          aiPrediction: { id: 'ai-10', rawResponse: {} },
        }),
        update: async () => ({}),
      },
      aiPrediction: {
        update: async (args: any) => {
          cachedWrite = args.data.rawResponse;
          return {};
        },
      },
    };

    const enCached = await translateComplaintToTargetLanguage(
      'c-10',
      'en',
      { id: 'cit-1', role: 'CITIZEN' },
      { db },
    );
    expect(enCached.cached).toBe(true);
    expect(enCached.title).toBe('Streetlight not working');

    const hiRes = await translateComplaintToTargetLanguage(
      'c-10',
      'hi',
      { id: 'cit-1', role: 'CITIZEN' },
      {
        db,
        translator: async () => ({
          titleTranslated: 'स्ट्रीट लाइट काम नहीं कर रही',
          descriptionTranslated: 'मुख्य सड़क पर लाइट बंद है',
          targetLanguage: 'hi',
          provider: 'gemini',
          fallbackTriggered: false,
        }),
      },
    );
    expect(hiRes.provider).toBe('gemini');
    expect(hiRes.title).toBe('स्ट्रीट लाइट काम नहीं कर रही');
    expect(cachedWrite.translations.hi.title).toBe('स्ट्रीट लाइट काम नहीं कर रही');

    await expect(
      translateComplaintToTargetLanguage('c-10', 'ta', { id: 'cit-other', role: 'CITIZEN' }, { db }),
    ).rejects.toBeInstanceOf(ComplaintTranslationError);
  });

  test('processPendingAiJobs completes valid jobs, retries with backoff, and handles P2021 safely', async () => {
    const updates: any[] = [];
    const mockDb = {
      aiProcessingJob: {
        findMany: async () => [
          {
            id: 'job-ok',
            complaintId: 'c-1',
            jobType: 'DUPLICATE_SCAN',
            attempts: 0,
            maxAttempts: 3,
            payload: {},
          },
          {
            id: 'job-fail',
            complaintId: 'c-2',
            jobType: 'TRANSLATE',
            attempts: 0,
            maxAttempts: 3,
            payload: { targetLanguage: 'ta' },
          },
        ],
        create: async () => {
          const e: any = new Error('Relation missing');
          e.code = 'P2021';
          throw e;
        },
        update: async (args: any) => {
          updates.push(args);
          return {};
        },
      },
    };

    const queued = await enqueueAiJob({ complaintId: 'c-1', jobType: 'DUPLICATE_SCAN' }, mockDb);
    expect(queued.queued).toBe(false);

    const summary = await processPendingAiJobs({
      db: mockDb,
      now: new Date('2026-11-12T10:00:00Z'),
      executors: {
        duplicateScan: async () => ({ ok: true, duplicates: [] } as any),
        translate: async () => {
          throw new Error('Upstream timeout');
        },
      },
    });

    expect(summary.processed).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.retried).toBe(1);
    const retryUpdate = updates.find((u) => u.where.id === 'job-fail' && u.data.status === 'PENDING');
    expect(retryUpdate).toBeTruthy();
  });
});
