import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';
import fs from 'node:fs';
import path from 'node:path';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

function setGeminiMock(mockConfig: {
  mode: 'success' | 'fail';
  language?: string;
  titleEn?: string | null;
  descriptionEn?: string | null;
  category?: string;
  priority?: string;
}) {
  fs.writeFileSync(path.join(process.cwd(), '.gemini-mock.json'), JSON.stringify(mockConfig), 'utf8');
}

function clearGeminiMock() {
  const p = path.join(process.cwd(), '.gemini-mock.json');
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
    } catch {
      // ignore
    }
  }
}

import prisma from '../src/lib/prisma';

async function createCitizenJwt() {
  const citizen = await prisma.user.findUnique({
    where: { id: 'citizen_9876543210' },
  }) || await prisma.user.findFirst({
    where: { role: 'CITIZEN', isSuspended: false },
  });

  return new SignJWT({
    sub: citizen?.id || 'citizen_9876543210',
    role: 'CITIZEN',
    name: citizen?.name || 'Bajrang Kumar',
    mobileNumber: citizen?.mobileNumber || '9876543210',
    email: citizen?.email || 'kumarbajrang0154@gmail.com',
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

async function createAdminJwt() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
  });
  return new SignJWT({
    sub: admin?.id || 'usr_super_admin',
    role: admin?.role || 'SUPER_ADMIN',
    name: admin?.name || 'Super Admin User',
    email: admin?.email || 'admin@intellicivic.gov',
    isAuthorized: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Complaint Multi-Language Triage & Staff English Translation Suite', () => {
  test.setTimeout(90000);

  test.beforeAll(async () => {
    clearGeminiMock();

    await prisma.user.updateMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
      data: { isSuspended: false, isAuthorized: true },
    });

    await prisma.user.updateMany({
      where: { role: 'CITIZEN' },
      data: { isSuspended: false, isAuthorized: true },
    });

    await prisma.user.update({
      where: { id: 'citizen_9876543210' },
      data: {
        name: 'Bajrang Kumar',
        email: 'kumarbajrang0154@gmail.com',
        address: '42 Civic Avenue, Ward 3, Coimbatore',
        isSuspended: false,
        isAuthorized: true,
      },
    }).catch(() => {});
  });
  test.afterEach(() => {
    clearGeminiMock();
  });

  test.afterAll(() => {
    clearGeminiMock();
  });

  test('1. Tamil complaint with mocked Gemini -> staff API/page shows English, citizen page shows Tamil', async ({
    page,
    context,
  }) => {
    setGeminiMock({
      mode: 'success',
      language: 'ta',
      titleEn: 'Major water pipe leakage on North Street',
      descriptionEn: 'Continuous clean drinking water flooding the road and blocking traffic.',
      category: 'cat-water',
      priority: 'HIGH',
    });

    const citizenToken = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: citizenToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Submit complaint via API as citizen
    const createRes = await page.request.post('/api/complaints', {
      data: {
        title: 'வடக்கு தெருவில் பெரிய தண்ணீர் குழாய் கசிவு',
        description: 'தொடர்ந்து சுத்தமான குடிநீர் சாலையில் வழிந்தோடி போக்குவரத்தை பாதிக்கிறது உடனடியாக நடவடிக்கை தேவை',
        categoryId: 'cat-water',
        imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80',
      },
    });

    expect(createRes.status()).toBe(201);
    const createdComplaint = await createRes.json();
    expect(createdComplaint.id).toBeDefined();
    expect(createdComplaint.language).toBe('ta');
    expect(createdComplaint.titleEn).toBe('Major water pipe leakage on North Street');
    expect(createdComplaint.descriptionEn).toBe('Continuous clean drinking water flooding the road and blocking traffic.');

    // 1a. Verify staff API returns English titleEn and descriptionEn
    const adminToken = await createAdminJwt();
    const staffApiRes = await page.request.get(`/api/complaints/${createdComplaint.id}`, {
      headers: {
        Cookie: `ic_access_token=${adminToken}`,
      },
    });
    expect(staffApiRes.status()).toBe(200);
    const staffCompData = await staffApiRes.json();
    expect(staffCompData.titleEn).toBe('Major water pipe leakage on North Street');
    expect(staffCompData.title).toBe('வடக்கு தெருவில் பெரிய தண்ணீர் குழாய் கசிவு');

    // 1b. Verify Staff Page shows English translation and NO fallback badge
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: adminToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto(`/admin/complaints/${createdComplaint.id}`);
    await page.locator('text=Loading Case Detail...').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});

    await expect(page.getByText('Major water pipe leakage on North Street')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Continuous clean drinking water flooding the road')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="original-language-badge"]')).toHaveCount(0);

    // 1c. Verify Citizen Page shows original Tamil text
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: citizenToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto(`/citizen/complaints/${createdComplaint.id}`);
    await expect(page.getByText('வடக்கு தெருவில் பெரிய தண்ணீர் குழாய் கசிவு')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('தொடர்ந்து சுத்தமான குடிநீர் சாலையில் வழிந்தோடி')).toBeVisible({ timeout: 20000 });
  });

  test('2. Gemini mocked to fail -> complaint still created, staff sees original with the label', async ({
    page,
    context,
  }) => {
    setGeminiMock({
      mode: 'fail',
    });

    const citizenToken = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: citizenToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Submit complaint when Gemini fails
    const createRes = await page.request.post('/api/complaints', {
      data: {
        title: 'சாலையில் பெரிய பள்ளம் மற்றும் ஆபத்து',
        description: 'சாலையில் மிக ஆழமான பள்ளம் உள்ளது வாகன ஓட்டிகளுக்கு விபத்து ஏற்படும் அபாயம்',
        categoryId: 'cat-roads',
        imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80',
      },
    });

    // Complaint creation must never fail even if Gemini fails
    expect(createRes.status()).toBe(201);
    const createdComplaint = await createRes.json();
    expect(createdComplaint.id).toBeDefined();
    expect(createdComplaint.titleEn).toBeNull();
    expect(createdComplaint.descriptionEn).toBeNull();
    expect(createdComplaint.language).toBe('ta');

    // Verify Staff Page shows original Tamil text with "Original language" badge
    const adminToken = await createAdminJwt();
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: adminToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto(`/admin/complaints/${createdComplaint.id}`);
    await page.locator('text=Loading Case Detail...').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});

    await expect(page.getByText('சாலையில் பெரிய பள்ளம் மற்றும் ஆபத்து')).toBeVisible({ timeout: 20000 });
    const badges = page.locator('[data-testid="original-language-badge"]');
    await expect(badges.first()).toBeVisible({ timeout: 20000 });
    await expect(badges.first()).toHaveText('Original language');
  });

  test('3. English complaint -> no extra label, no titleEn needed', async ({
    page,
    context,
  }) => {
    setGeminiMock({
      mode: 'success',
      language: 'en',
      titleEn: null,
      descriptionEn: null,
      category: 'cat-sanitation',
      priority: 'MEDIUM',
    });

    const citizenToken = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: citizenToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    const createRes = await page.request.post('/api/complaints', {
      data: {
        title: 'Overflowing public dumpster near community park',
        description: 'Trash has not been collected for three days and is spilling onto the walkway.',
        categoryId: 'cat-sanitation',
        imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80',
      },
    });

    expect(createRes.status()).toBe(201);
    const createdComplaint = await createRes.json();
    expect(createdComplaint.id).toBeDefined();
    expect(createdComplaint.language).toBe('en');
    expect(createdComplaint.titleEn).toBeNull();

    // Verify Staff Page displays English title and NO Original language badge
    const adminToken = await createAdminJwt();
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: adminToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto(`/admin/complaints/${createdComplaint.id}`);
    await page.locator('text=Loading Case Detail...').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});

    await expect(page.getByText('Overflowing public dumpster near community park')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="original-language-badge"]')).toHaveCount(0);
  });

  test('4. offline-synced draft goes through the same path', async ({
    page,
    context,
  }) => {
    setGeminiMock({
      mode: 'success',
      language: 'ta',
      titleEn: 'Streetlights not working for one week',
      descriptionEn: 'The entire residential street is completely dark creating safety hazard.',
      category: 'cat-electricity',
      priority: 'HIGH',
    });

    const citizenToken = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: citizenToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    const clientRequestId = `offline_sync_test_${Date.now()}`;
    const capturedAt = new Date().toISOString();

    // Post offline draft payload with clientRequestId and capturedAt
    const createRes = await page.request.post('/api/complaints', {
      data: {
        title: 'ஒரு வாரமாக தெருவிளக்குகள் எரியவில்லை',
        description: 'முழு குடியிருப்பு பகுதியும் இருட்டாக உள்ளது பொதுமக்களுக்கு பாதுகாப்பு அச்சுறுத்தல்',
        categoryId: 'cat-electricity',
        imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80',
        clientRequestId,
        capturedAt,
      },
    });

    expect(createRes.status()).toBe(201);
    const createdComplaint = await createRes.json();
    expect(createdComplaint.id).toBeDefined();

    // Verify stored fields in database
    const dbComp = await prisma.complaint.findUnique({
      where: { id: createdComplaint.id },
    });
    expect(dbComp?.clientRequestId).toBe(clientRequestId);
    expect(dbComp?.language).toBe('ta');
    expect(dbComp?.titleEn).toBe('Streetlights not working for one week');
    expect(dbComp?.descriptionEn).toBe('The entire residential street is completely dark creating safety hazard.');

    // Verify Staff Page displays translated English title
    const adminToken = await createAdminJwt();
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: adminToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto(`/admin/complaints/${createdComplaint.id}`);
    await page.locator('text=Loading Case Detail...').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});

    await expect(page.getByText('Streetlights not working for one week')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('The entire residential street is completely dark')).toBeVisible({ timeout: 20000 });
  });
});
