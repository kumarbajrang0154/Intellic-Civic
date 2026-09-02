import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Bajrang Kumar 07/.gemini/antigravity-ide/brain/652d066f-b656-4386-bfff-612ab59b8cc2';

test.describe('Capture Remaining Citizen Screenshots', () => {
  test.beforeEach(async ({ page, context }) => {
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

  test('2. Screenshot: Duplicate Warning Card on New Complaint submission', async ({ page }) => {
    await page.goto('http://localhost:3000/citizen/complaints/new');
    await page.waitForSelector('#title', { timeout: 15000 });
    await page.fill('#title', 'Severe pothole causing traffic congestion near Central Metro');
    await page.fill('#description', 'A deep 2-foot pothole has opened up on Main Arterial Road near Metro Gate 3 causing hazards.');
    await page.click('button[type="submit"]');

    await page.waitForSelector('text=Similar Complaint Already Reported Nearby', { timeout: 20000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'citizen_duplicate_warning_card.png'),
      fullPage: true,
    });
  });

  test('3. Screenshot: REJECTED complaint with Category Override Badge and Staff Notes', async ({ page }) => {
    await page.goto('http://localhost:3000/citizen/complaints/cmp-rejected-demo');
    await page.waitForSelector('text=Official Municipal Note', { timeout: 20000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'citizen_rejected_category_override_notes.png'),
      fullPage: true,
    });
  });
});
