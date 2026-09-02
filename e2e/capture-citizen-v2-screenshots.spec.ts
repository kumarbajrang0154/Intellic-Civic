import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Bajrang Kumar 07/.gemini/antigravity-ide/brain/652d066f-b656-4386-bfff-612ab59b8cc2';

test.describe('Capture Citizen Portal v2 Verification Screenshots', () => {
  test.beforeEach(async ({ page, context }) => {
    // Authenticate via API to bypass UI login form
    const res = await page.request.post('http://localhost:3000/api/auth/verify-otp', {
      data: { mobileNumber: '9876543210', otp: '123456' },
    });
    const cookiesHeader = res.headers()['set-cookie'] || '';
    const match = cookiesHeader.match(/ic_access_token=([^;]+)/);
    if (match) {
      await context.addCookies([
        {
          name: 'ic_access_token',
          value: match[1],
          domain: 'localhost',
          path: '/',
        },
      ]);
    }
  });

  test('1. Screenshot: RESOLVED complaint with Satisfactory, Reopen, and Star Rating Feedback', async ({ page }) => {
    await page.goto('/citizen/complaints/cmp-resolved-demo');
    await page.waitForSelector('text=Resolution Experience Feedback', { timeout: 15000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'citizen_resolved_satisfactory_reopen_feedback.png'),
      fullPage: true,
    });
  });

  test('2. Screenshot: Duplicate Warning Card on New Complaint submission', async ({ page }) => {
    await page.goto('/citizen/complaints/new');
    await page.fill('#title', 'Severe pothole causing traffic congestion near Central Metro');
    await page.fill('#description', 'A deep 2-foot pothole has opened up on Main Arterial Road near Metro Gate 3 causing hazards.');
    await page.click('button[type="submit"]');

    await page.waitForSelector('text=Similar Complaint Already Reported Nearby', { timeout: 15000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'citizen_duplicate_warning_card.png'),
      fullPage: true,
    });
  });

  test('3. Screenshot: REJECTED complaint with Category Override Badge and Staff Notes', async ({ page }) => {
    await page.goto('/citizen/complaints/cmp-rejected-demo');
    await page.waitForSelector('text=Official Municipal Note', { timeout: 15000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'citizen_rejected_category_override_notes.png'),
      fullPage: true,
    });
  });

  test('4. Screenshot: My Complaints Dashboard with Search Bar & Date Filter', async ({ page }) => {
    await page.goto('/citizen');
    await page.waitForSelector('input[placeholder*="Search title"]', { timeout: 15000 });

    await page.fill('input[placeholder*="Search title"]', 'pothole');
    const today = new Date().toISOString().slice(0, 10);
    await page.fill('input[type="date"] >> nth=0', '2026-09-01');
    await page.fill('input[type="date"] >> nth=1', today);

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'citizen_my_complaints_search_date_filters.png'),
      fullPage: true,
    });
  });
});
