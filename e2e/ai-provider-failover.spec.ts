import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { SignJWT } from 'jose';
import prisma from '@/lib/prisma';
import {
  classifyComplaintRouting,
  verifyComplaintPhoto,
  checkAiHealth,
  getActiveAiProvider,
  getGroqModel,
  DEFAULT_CATEGORIES,
} from '@/services/ai-provider';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-super-secret-jwt-key-2026');

async function createAdminJwt() {
  const admin = (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } })) || (await prisma.user.findFirst({ where: { role: 'ADMIN' } }));
  return new SignJWT({
    sub: admin!.id,
    role: admin!.role,
    name: admin!.name || 'Super Admin',
    email: admin!.email,
    isAuthorized: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

async function createCitizenJwt(id = 'citizen_triage_test', mobile = '9876543299') {
  return new SignJWT({
    sub: id,
    role: 'CITIZEN',
    name: 'Triage Test Citizen',
    mobileNumber: mobile,
    email: 'triagecitizen@example.com',
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Multi-Provider AI Auto-Failover & Visibility Suite', () => {
  const originalEnv = { ...process.env };

  test.beforeEach(() => {
    process.env = { ...originalEnv };
  });

  test.afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('1. Gemini OK: returns Gemini classification without failover or heuristics', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-valid-gemini-key';

    // Mock global fetch for Gemini SDK endpoint
    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        category: 'cat-roads',
                        priority: 'HIGH',
                        reasoning: 'Critical asphalt cave-in on arterial transit lane.',
                        language: 'en',
                        titleEn: null,
                        descriptionEn: null,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting(
        'Dangerous deep pothole on fast-moving junction road',
        'Large road pothole',
        DEFAULT_CATEGORIES,
      );

      expect(result.fallbackTriggered).toBe(false);
      expect(result.category).toBe('cat-roads');
      expect(result.priority).toBe('HIGH');
      expect(result.provider).toBe('gemini');
      expect(result.reasoning).toContain('Critical asphalt cave-in');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('2. Gemini 403 Forbidden -> Auto-failover to Groq succeeds cleanly', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-denied-gemini-key';
    process.env.GROQ_API_KEY = 'gsk_mock_valid_groq_key_998877';
    process.env.GROQ_MODEL = 'qwen/qwen3.8-27b';

    const originalFetch = global.fetch;
    let groqEndpointCalled = false;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      // Gemini fails with 403 Forbidden (project permission denied)
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'The caller does not have permission for the requested project [PERMISSION_DENIED]',
              status: 'PERMISSION_DENIED',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Groq succeeds with valid JSON structured output
      if (url.includes('api.groq.com/openai/v1/chat/completions')) {
        groqEndpointCalled = true;
        const requestBody = JSON.parse(init?.body as string || '{}');
        expect(requestBody.model).toBe('qwen/qwen3.8-27b');

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    category: 'cat-water',
                    priority: 'CRITICAL',
                    reasoning: 'Massive burst water main flooding street corridor.',
                    language: 'en',
                    titleEn: null,
                    descriptionEn: null,
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting(
        'Water pipe burst spraying high pressure water across roadway',
        'Pipe burst emergency',
        DEFAULT_CATEGORIES,
      );

      expect(groqEndpointCalled).toBe(true);
      expect(result.fallbackTriggered).toBe(false);
      expect(result.category).toBe('cat-water');
      expect(result.priority).toBe('CRITICAL');
      expect(result.provider).toBe('groq');
      expect(result.reasoning).toContain('Massive burst water main');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('3. Both Gemini and Groq fail -> Fallback to keyword heuristics with honest banner', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-denied-gemini-key';
    process.env.GROQ_API_KEY = 'mock-failed-groq-key';

    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      // Gemini fails with 403
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: { code: 403, message: 'Google project denied' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Groq also fails with 500
      if (url.includes('api.groq.com/openai/v1/chat/completions')) {
        return new Response(
          JSON.stringify({
            error: { message: 'Groq inference capacity temporarily unavailable' },
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting(
        'Electric transformer sparking with smoke causing extreme danger near school gate',
        'Electric wire sparking emergency danger',
        DEFAULT_CATEGORIES,
      );

      expect(result.fallbackTriggered).toBe(true);
      expect(result.category).toBe('cat-electricity');
      expect(result.priority).toBe('CRITICAL');
      expect(result.reasoning).toContain('AI unavailable — fallback used');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('4. Live health check against second provider using key from .env (never printing it)', async () => {
    // Read the actual GROQ_API_KEY from .env
    const groqKey = process.env.GROQ_API_KEY?.trim();

    process.env.AI_PROVIDER = 'groq';

    const health = await checkAiHealth();

    expect(health).toBeDefined();
    expect(health.provider).toBe('groq');
    expect(health.model).toBeTruthy();
    expect(typeof health.status).toBe('number');
    expect(typeof health.latencyMs).toBe('number');

    // Security assertion: Never leak key in output or error message
    if (groqKey && groqKey.length > 5) {
      if (health.error) {
        expect(health.error).not.toContain(groqKey);
      }
    }

    if (!groqKey || groqKey === '' || groqKey === 'your_groq_api_key_here') {
      // If unconfigured in local dev / test run, health check reports clean 400 without crashing
      expect(health.ok).toBe(false);
      expect(health.status).toBe(400);
      expect(health.error).toContain('GROQ_API_KEY');
    } else {
      // If configured with real key, asserts live status code without printing key
      console.log(`[Groq Live Check Result] Status: ${health.status}, Latency: ${health.latencyMs}ms, Model: ${health.model}`);
      expect([200, 401, 429]).toContain(health.status);
    }
  });

  test('5. Inert failover: with GROQ_API_KEY empty and Gemini OK, prove no Groq call is made', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-valid-gemini-key';
    delete process.env.GROQ_API_KEY;

    let groqCallMade = false;
    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('api.groq.com')) {
        groqCallMade = true;
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        category: 'cat-sanitation',
                        priority: 'MEDIUM',
                        reasoning: 'Overflowing garbage bin on street corner.',
                        language: 'en',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting('Garbage dump not cleared', 'Garbage dump', DEFAULT_CATEGORIES);
      expect(result.fallbackTriggered).toBe(false);
      expect(result.provider).toBe('gemini');
      expect(groqCallMade).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('6. With Gemini 403 mocked and no Groq key, result is heuristics plus a clear reason', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-denied-gemini-key';
    delete process.env.GROQ_API_KEY;

    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: { code: 403, message: 'Google project permission denied' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting(
        'Water pipeline leaking heavily onto the main junction',
        'Water leak emergency',
        DEFAULT_CATEGORIES,
      );
      expect(result.fallbackTriggered).toBe(true);
      expect(result.provider).toBe('fallback');
      expect(result.category).toBe('cat-water');
      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning).toContain('AI unavailable — fallback used');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('7. Retry test: mock 503, 503, 200 asserts 3 calls with 1s and 2s delays', async () => {
    test.setTimeout(30000);
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-valid-gemini-key';
    delete process.env.GROQ_API_KEY;

    let callCount = 0;
    const timestamps: number[] = [];
    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('generativelanguage.googleapis.com')) {
        callCount++;
        timestamps.push(Date.now());
        if (callCount === 1 || callCount === 2) {
          return new Response(
            JSON.stringify({ error: { code: 503, message: 'The model is overloaded. Please try again later.' } }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        category: 'cat-roads',
                        priority: 'HIGH',
                        confidence: 0.95,
                        reasoning: 'Road pothole identified after 503 retries.',
                        language: 'en',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting('Deep pothole on road', 'Pothole issue', DEFAULT_CATEGORIES);
      expect(callCount).toBe(3);
      expect(result.fallbackTriggered).toBe(false);
      expect(result.provider).toBe('gemini');
      expect(result.category).toBe('cat-roads');

      // Assert delays: first delay >= 900ms (1s backoff), second delay >= 1800ms (2s backoff)
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay1).toBeGreaterThanOrEqual(900);
      expect(delay2).toBeGreaterThanOrEqual(1800);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('8. Retry test: mock 503 x3 asserts 3 calls and fallback triggered', async () => {
    test.setTimeout(30000);
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-valid-gemini-key';
    delete process.env.GROQ_API_KEY;

    let callCount = 0;
    const timestamps: number[] = [];
    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('generativelanguage.googleapis.com')) {
        callCount++;
        timestamps.push(Date.now());
        return new Response(
          JSON.stringify({ error: { code: 503, message: 'Service Unavailable' } }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting('Deep pothole on road', 'Pothole issue', DEFAULT_CATEGORIES);
      expect(callCount).toBe(3);
      expect(result.fallbackTriggered).toBe(true);
      expect(result.provider).toBe('fallback');
      expect(result.reasoning).toContain('AI unavailable — fallback used');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('9. Fallback complaint: mock provider=fallback, create complaint, assert DB categoryId null, needsTriage true, citizen message shown', async ({
    page,
    request,
    context,
  }) => {
    test.setTimeout(60000);
    // 1. Citizen user in DB with complete profile to prevent AppShell redirect
    const mun = await prisma.municipality.findFirst();
    const citizen = await prisma.user.create({
      data: {
        name: 'Triage Test Citizen',
        mobileNumber: `987654${Date.now().toString().slice(-4)}`,
        email: `triage_${Date.now()}@example.com`,
        address: '123 Smart Civic Street, Ward 4',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TriageCitizen',
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        municipalityId: mun?.id,
      },
    });

    const citizenToken = await createCitizenJwt(citizen.id, citizen.mobileNumber!);
    const cookieHeader = `ic_access_token=${citizenToken}`;

    // Create complaint via POST /api/complaints mocking provider=fallback
    const res = await request.post('http://localhost:3000/api/complaints', {
      headers: {
        cookie: cookieHeader,
        'Content-Type': 'application/json',
        'x-mock-ai-provider': 'fallback',
      },
      data: {
        title: 'Unknown civic concern needing municipal review',
        description: 'Unspecified issue requiring manual inspection and triage by municipal authorities in ward 4.',
        evidence: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP/'],
        mockAiProvider: 'fallback',
      },
    });

    expect(res.status()).toBe(201);
    const created = await res.json();
    expect(created.id).toBeTruthy();

    // 2. DB assertion: categoryId must be null, and complaint requires triage
    const dbComplaint = await prisma.complaint.findUnique({
      where: { id: created.id },
      include: { category: true, department: true },
    });
    expect(dbComplaint).not.toBeNull();
    expect(dbComplaint?.categoryId).toBeNull();
    expect(created.needsTriage).toBe(true);

    // 3. Citizen detail view assertion: Under Review notice shown
    await context.addCookies([
      { name: 'ic_access_token', value: citizenToken, domain: 'localhost', path: '/' },
    ]);
    await page.goto(`/citizen/complaints/${created.id}`);
    await page.waitForLoadState('domcontentloaded');

    const triageNotice = page.locator('[data-testid="citizen-triage-notice"]').first();
    await expect(triageNotice).toBeVisible({ timeout: 15000 });
    await expect(triageNotice).toContainText(/Under Review|reviewed by staff/i);

    // Clean up created complaint & citizen
    await prisma.statusHistory.deleteMany({ where: { complaintId: created.id } });
    await prisma.complaintImage.deleteMany({ where: { complaintId: created.id } });
    await prisma.aiPrediction.deleteMany({ where: { complaintId: created.id } });
    await prisma.complaint.delete({ where: { id: created.id } });
    await prisma.user.delete({ where: { id: citizen.id } });
  });

  test('10. Admin UI: Needs triage filter/badge & manual assign action on admin complaints list, screenshot saved', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    // 1. Create a pristine test complaint in DB with categoryId = null, departmentId = null
    const mun = await prisma.municipality.findFirst();
    const citizen = (await prisma.user.findFirst({ where: { role: 'CITIZEN' } })) || (await prisma.user.create({
      data: {
        name: 'Triage Fixture Citizen',
        email: `triage_${Date.now()}@example.com`,
        address: '456 Municipal Way, Ward 2',
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        municipalityId: mun?.id,
      },
    }));

    const ticketId = `TRG-${Date.now().toString().slice(-6)}`;
    const triageComplaint = await prisma.complaint.create({
      data: {
        ticketId,
        title: 'Emergency Unassigned Civic Hazard for Admin Triage',
        description: 'Citizen submitted an unassigned complaint that requires immediate department assignment by admin staff.',
        status: 'SUBMITTED',
        priority: 'HIGH',
        categoryId: null,
        departmentId: null,
        citizenId: citizen.id,
        municipalityId: mun?.id,
      },
    });

    const adminToken = await createAdminJwt();
    await context.addCookies([
      { name: 'ic_access_token', value: adminToken, domain: 'localhost', path: '/' },
    ]);

    // 2. Navigate to Admin Complaints List
    await page.goto('/admin/complaints');
    await page.waitForLoadState('domcontentloaded');

    // Wait for table to load
    await expect(page.getByText(/Loading system complaints/i)).not.toBeVisible({ timeout: 25000 });

    // Search for the newly created complaint ticket to bring it to view
    const searchInput = page.getByPlaceholder(/Ticket ID or title/i);
    await searchInput.fill(ticketId);
    await page.waitForTimeout(500);

    // 3. Assert Needs Triage badge is visible in table
    const badge = page.locator('[data-testid="needs-triage-badge"]').first();
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText(/Needs Triage/i);

    // 4. Capture screenshot of Admin UI with Needs Triage badge & filter
    fs.mkdirSync('test-results', { recursive: true });
    const screenshotPath = path.resolve('test-results/admin-complaints-needs-triage.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('[Admin Needs Triage Screenshot Saved]:', screenshotPath);
    expect(fs.existsSync(screenshotPath)).toBe(true);

    // 5. Test Manual Assign Action
    const assignBtn = page.locator(`[data-testid="manual-assign-${triageComplaint.id}"]`);
    await expect(assignBtn).toBeVisible();
    await assignBtn.click();

    // Dialog appears
    const dialogTitle = page.getByRole('heading', { name: /Manual Triage & Assignment/i });
    await expect(dialogTitle).toBeVisible();

    // Select target department
    const deptSelect = page.locator('[data-testid="target-dept-select"]');
    await expect(deptSelect).toBeVisible();
    const firstOption = await deptSelect.locator('option:not([value=""])').first().getAttribute('value');
    if (firstOption) {
      await deptSelect.selectOption(firstOption);
    }

    // Confirm Assignment button clicked
    const confirmBtn = page.getByRole('button', { name: /Confirm Assignment/i });
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
    await confirmBtn.click();

    // Toast appears
    await expect(page.getByText(/successfully triaged and assigned/i)).toBeVisible({ timeout: 20000 });

    // Assert DB complaint now has a department assigned
    const updated = await prisma.complaint.findUnique({ where: { id: triageComplaint.id } });
    expect(updated?.departmentId).not.toBeNull();

    // Clean up
    await prisma.statusHistory.deleteMany({ where: { complaintId: triageComplaint.id } });
    await prisma.complaint.delete({ where: { id: triageComplaint.id } });
  });
});
