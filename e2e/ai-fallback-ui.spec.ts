import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createDeptHeadJwt() {
  return new SignJWT({
    sub: 'dept-head-test-user',
    role: 'DEPARTMENT_HEAD',
    departmentId: 'dept-sanitation-1',
    isAuthorized: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

async function createOfficerJwt() {
  return new SignJWT({
    sub: 'officer-test-user',
    role: 'DEPARTMENT_OFFICER',
    departmentId: 'dept-sanitation-1',
    isAuthorized: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Task 3e — AI unavailable fallback badge verification', () => {
  test('Department Head complaint detail page shows "AI unavailable - fallback used" when fallback fires', async ({
    page,
    context,
  }) => {
    const token = await createDeptHeadJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'dept-head-test-user',
            name: 'Sanitation Head',
            role: 'DEPARTMENT_HEAD',
            departmentId: 'dept-sanitation-1',
          },
        }),
      });
    });

    await page.route('**/api/complaints/c-fallback-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-fallback-1',
          ticketId: 'CMP-FLBK-001',
          title: 'Overflowing dumpster behind market',
          description: 'Garbage not collected for 3 days and smelling bad.',
          status: 'PENDING_DEPT_REVIEW',
          priority: 'MEDIUM',
          createdAt: new Date().toISOString(),
          aiPrediction: {
            confidenceScore: 0.35,
            suggestedCategoryId: 'cat-sanitation',
            rawResponse: {
              provider: 'fallback',
              needsManualTriage: true,
              recommendation: 'Low confidence or AI fallback: flagged for manual triage and review by staff.',
              statusMessage: 'Complaint will be reviewed by staff',
              aiRouting: {
                category: 'cat-sanitation',
                priority: 'MEDIUM',
                confidence: 0.35,
                reasoning: 'AI unavailable — fallback used (AI service unavailable or unconfigured). Will be reviewed by staff.',
                fallbackTriggered: true,
                provider: 'fallback',
              },
            },
          },
        }),
      });
    });

    await page.route('**/api/departments/*/staff', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ officers: [], fieldWorkers: [] }),
      });
    });

    await page.goto('/department-head/complaints/c-fallback-1');
    const badge = page.getByText('AI unavailable - fallback used').first();
    await expect(badge).toBeVisible({ timeout: 15000 });
  });

  test('Officer complaint detail page shows "AI unavailable - fallback used" when fallback fires', async ({
    page,
    context,
  }) => {
    const token = await createOfficerJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'officer-test-user',
            name: 'Officer User',
            role: 'DEPARTMENT_OFFICER',
            departmentId: 'dept-sanitation-1',
          },
        }),
      });
    });

    await page.route('**/api/complaints/c-fallback-2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-fallback-2',
          ticketId: 'CMP-FLBK-002',
          title: 'Street light broken',
          description: 'Light has been off for a week.',
          status: 'ASSIGNED',
          priority: 'MEDIUM',
          createdAt: new Date().toISOString(),
          aiPrediction: {
            confidenceScore: 0.4,
            suggestedCategoryId: 'cat-electricity',
            rawResponse: {
              provider: 'fallback',
              needsManualTriage: true,
              recommendation: 'Low confidence or AI fallback: flagged for manual triage and review by staff.',
              statusMessage: 'Complaint will be reviewed by staff',
              aiRouting: {
                category: 'cat-electricity',
                priority: 'MEDIUM',
                confidence: 0.4,
                reasoning: 'AI unavailable — fallback used (mocked Gemini failure)',
                fallbackTriggered: true,
                provider: 'fallback',
              },
            },
          },
        }),
      });
    });

    await page.route('**/api/departments/*/staff', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ officers: [], fieldWorkers: [] }),
      });
    });

    await page.goto('/officer/complaints/c-fallback-2');
    const badge = page.getByText('AI unavailable - fallback used').first();
    await expect(badge).toBeVisible({ timeout: 15000 });
  });
});

