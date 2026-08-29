import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

async function createMockJwt(role: string = 'ADMIN'): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'admin-user-001',
      email: 'superadmin@city.gov.in',
      role,
      name: 'Super Admin User',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');
  return `${header}.${payload}.mock_signature`;
}

const screenshotDir = path.resolve(process.cwd(), 'docs/screenshots/admin');

test.beforeAll(() => {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
});

test.describe('Capture Super Admin Portal Screenshots', () => {
  test.beforeEach(async ({ page, context }) => {
    const token = await createMockJwt('ADMIN');
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/admin/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalComplaints: 142,
          pendingTriage: 8,
          pendingApprovals: 3,
          totalDepartments: 6,
          totalCategories: 12,
          totalUsers: 28,
        }),
      });
    });

    await page.route('**/api/departments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'dept-roads-1', name: 'Roads & Infrastructure', code: 'ROADS', description: 'Road repairs and streetlights' },
          { id: 'dept-water-2', name: 'Water Supply & Sanitation', code: 'WATER', description: 'Water pipelines and supply issues' },
          { id: 'dept-health-3', name: 'Public Health & Waste', code: 'HEALTH', description: 'Garbage collection and sanitation' },
          { id: 'dept-electricity-4', name: 'Electricity & Lighting', code: 'ELEC', description: 'Power outages and high voltage lines' },
        ]),
      });
    });

    await page.route('**/api/categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-pothole-1', name: 'Pothole Repair', description: 'Deep crater on road surface', departmentId: 'dept-roads-1', department: { id: 'dept-roads-1', name: 'Roads & Infrastructure' } },
          { id: 'cat-water-2', name: 'Water Pipe Leak', description: 'Burst water main line', departmentId: 'dept-water-2', department: { id: 'dept-water-2', name: 'Water Supply & Sanitation' } },
          { id: 'cat-garbage-3', name: 'Illegal Garbage Dumping', description: 'Overflowing waste dump', departmentId: 'dept-health-3', department: { id: 'dept-health-3', name: 'Public Health & Waste' } },
        ]),
      });
    });

    await page.route('**/api/complaints?needsTriage=true*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'cmp-triage-101',
              ticketId: 'CMP-2026-T101',
              title: 'Low confidence water leakage near market',
              description: 'Water has been flowing onto the main road near Central Market since yesterday morning. Unsure which ward or department handles this specific area pipeline.',
              status: 'SUBMITTED',
              createdAt: '2026-08-28T10:15:00Z',
              aiPrediction: {
                suggestedDepartmentId: 'dept-water-2',
                suggestedDepartment: { name: 'Water Supply & Sanitation' },
                confidenceScore: 0.48,
                isRejected: false,
              },
            },
            {
              id: 'cmp-triage-102',
              ticketId: 'CMP-2026-T102',
              title: 'Hazardous broken streetlight pole',
              description: 'Streetlight pole leaning dangerous after heavy truck collision.',
              status: 'SUBMITTED',
              createdAt: '2026-08-28T11:45:00Z',
              aiPrediction: {
                suggestedDepartmentId: 'dept-roads-1',
                suggestedDepartment: { name: 'Roads & Infrastructure' },
                confidenceScore: 0.52,
                isRejected: true,
              },
            },
          ],
        }),
      });
    });

    await page.route('**/api/users?pendingOnly=true*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'usr-p1', name: 'Anil Sharma', email: 'anil.sharma@city.gov.in', role: null, isAuthorized: false, departmentId: null, createdAt: '2026-08-28T09:00:00Z' },
            { id: 'usr-p2', name: 'Priya Verma', email: 'priya.verma@city.gov.in', role: null, isAuthorized: false, departmentId: null, createdAt: '2026-08-28T14:30:00Z' },
          ],
        }),
      });
    });

    await page.route('**/api/users*', async (route) => {
      if (route.request().url().includes('pendingOnly=true')) return;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'usr-1', name: 'Rajesh Kumar', email: 'rajesh.head@city.gov.in', role: 'DEPARTMENT_HEAD', isAuthorized: true, departmentId: 'dept-roads-1', department: { id: 'dept-roads-1', name: 'Roads & Infrastructure' }, createdAt: '2026-01-15T00:00:00Z' },
            { id: 'usr-2', name: 'Suresh Singh', email: 'suresh.officer@city.gov.in', role: 'DEPARTMENT_OFFICER', isAuthorized: true, departmentId: 'dept-roads-1', department: { id: 'dept-roads-1', name: 'Roads & Infrastructure' }, createdAt: '2026-02-10T00:00:00Z' },
            { id: 'usr-3', name: 'Super Admin User', email: 'superadmin@city.gov.in', role: 'ADMIN', isAuthorized: true, departmentId: null, createdAt: '2025-12-01T00:00:00Z' },
          ],
        }),
      });
    });

    await page.route('**/api/complaints*', async (route) => {
      if (route.request().url().includes('needsTriage=true') || route.request().url().includes('cmp-detail-101')) return;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'cmp-1',
              ticketId: 'CMP-2026-001',
              title: 'Major Pothole on MG Road',
              description: 'Large crater near MG Road signal causing severe traffic bottleneck.',
              status: 'IN_PROGRESS',
              priority: 'HIGH',
              createdAt: '2026-08-27T08:30:00Z',
              department: { id: 'dept-roads-1', name: 'Roads & Infrastructure' },
              category: { id: 'cat-pothole-1', name: 'Pothole Repair' },
              citizen: { name: 'Vikram Mehta', email: 'vikram@gmail.com' },
            },
            {
              id: 'cmp-2',
              ticketId: 'CMP-2026-002',
              title: 'Water Supply Outage Ward 4',
              description: 'No tap water supply for past 36 hours in Sector 4 housing colony.',
              status: 'PENDING_DEPT_REVIEW',
              priority: 'CRITICAL',
              createdAt: '2026-08-28T06:10:00Z',
              department: { id: 'dept-water-2', name: 'Water Supply & Sanitation' },
              category: { id: 'cat-water-2', name: 'Water Pipe Leak' },
              citizen: { name: 'Sunita Rao', email: 'sunita@gmail.com' },
            },
          ],
        }),
      });
    });

    await page.route('**/api/complaints/cmp-detail-101', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cmp-detail-101',
          ticketId: 'CMP-2026-001',
          title: 'Major Pothole on MG Road Junction',
          description: 'Deep pothole measuring 4ft across on the main lane of MG Road. Multiple commuters reported tire damage during peak evening traffic.',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          createdAt: '2026-08-27T08:30:00Z',
          resolvedAt: null,
          departmentId: 'dept-roads-1',
          department: { id: 'dept-roads-1', name: 'Roads & Infrastructure' },
          category: { name: 'Pothole Repair' },
          citizen: { name: 'Vikram Mehta', email: 'vikram.mehta@gmail.com', mobileNumber: '+919876543210' },
          location: { address: 'MG Road Junction, Ward 12, Sector 4', latitude: 28.6139, longitude: 77.209 },
          aiPrediction: {
            id: 'pred-101',
            confidenceScore: 0.94,
            rawResponse: { classification: 'ROADS', confidence: 0.94, reasoning: 'Mentions pothole, road crater and traffic disruption on MG Road.' },
            isRejected: false,
            suggestedDepartment: { name: 'Roads & Infrastructure' },
            suggestedCategory: { name: 'Pothole Repair' },
          },
          assignment: {
            assignedAt: '2026-08-27T10:00:00Z',
            departmentOfficer: { name: 'Suresh Singh', email: 'suresh.officer@city.gov.in' },
          },
          evidence: [
            {
              id: 'ev-1',
              stage: 'BEFORE',
              imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',
              uploadedAt: '2026-08-27T08:35:00Z',
            },
          ],
          statusHistory: [
            { id: 'sh-1', fromStatus: null, toStatus: 'SUBMITTED', changedAt: '2026-08-27T08:30:00Z' },
            { id: 'sh-2', fromStatus: 'SUBMITTED', toStatus: 'PENDING_DEPT_REVIEW', changedAt: '2026-08-27T08:32:00Z' },
            { id: 'sh-3', fromStatus: 'PENDING_DEPT_REVIEW', toStatus: 'ASSIGNED', changedAt: '2026-08-27T10:00:00Z' },
            { id: 'sh-4', fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedAt: '2026-08-27T11:15:00Z' },
          ],
        }),
      });
    });
  });

  const pages = [
    { url: '/admin', name: '01_admin_dashboard' },
    { url: '/admin/triage', name: '02_admin_triage' },
    { url: '/admin/users/pending', name: '03_admin_pending_users' },
    { url: '/admin/users', name: '04_admin_all_users' },
    { url: '/admin/departments', name: '05_admin_departments' },
    { url: '/admin/categories', name: '06_admin_categories' },
    { url: '/admin/complaints', name: '07_admin_complaints' },
    { url: '/admin/complaints/cmp-detail-101', name: '08_admin_complaint_detail' },
  ];

  for (const pageItem of pages) {
    test(`Capture desktop & mobile screenshots for ${pageItem.url}`, async ({ page }) => {
      // Desktop Viewport (1280x800)
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(pageItem.url);
      await page.waitForTimeout(1200);
      const desktopPath = path.join(screenshotDir, `${pageItem.name}_desktop.png`);
      await page.screenshot({ path: desktopPath, fullPage: true });

      // Mobile Viewport (375x812 - iPhone X/12)
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(pageItem.url);
      await page.waitForTimeout(1200);
      const mobilePath = path.join(screenshotDir, `${pageItem.name}_mobile.png`);
      await page.screenshot({ path: mobilePath, fullPage: true });
    });
  }
});
