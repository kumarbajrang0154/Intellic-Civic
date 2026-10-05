import { test, expect } from '@playwright/test';
import { attachOutcomeListeners, createAuthJwt, setAuthCookie, VIEWPORTS } from './sweep-helpers';
import prisma from '../../src/lib/prisma';

test.describe('Citizen Portal Outcome-Based Bug Sweep', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.beforeEach(async ({ page, context }) => {
        test.setTimeout(60000);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        // Suppress PWA install banner from intercepting clicks
        await context.addInitScript(() => {
          localStorage.setItem('ic_pwa_install_dismissed', String(Date.now()));
        });
      });

      test('1. OTP Login Flow: enter mobile number, send OTP, verify OTP -> redirects to /citizen', async ({
        page,
      }) => {
        const outcome = attachOutcomeListeners(page);

        await page.goto('/login/citizen');
        await page.waitForLoadState('domcontentloaded');

        // Dismiss PWA banner if it rendered
        const dismissBannerBtn = page.getByRole('button', { name: /dismiss install banner/i });
        if (await dismissBannerBtn.isVisible()) {
          await dismissBannerBtn.click();
        }

        // Fill phone number
        const phoneInput = page.locator('input[type="tel"], input#mobile, input[placeholder*="mobile" i], input[placeholder*="phone" i], input[placeholder*="9876543210"]').first();
        await expect(phoneInput).toBeVisible({ timeout: 10000 });
        await phoneInput.fill('9876543210');

        // Click Send OTP
        const sendOtpBtn = page.getByRole('button', { name: /send verification otp|send otp|get otp|request otp/i });
        const [otpResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/auth/send-otp')),
          sendOtpBtn.click(),
        ]);
        expect(otpResponse.status(), 'POST /api/auth/send-otp must succeed').toBe(200);

        // Fill OTP digits via auto-fill or digit inputs
        const autoFillBtn = page.getByRole('button', { name: /auto-fill otp/i });
        if (await autoFillBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await autoFillBtn.click();
        } else {
          const digitInputs = page.locator('input[inputmode="numeric"], input[type="text"][maxlength="1"]');
          const count = await digitInputs.count();
          for (let i = 0; i < Math.min(count, 6); i++) {
            await digitInputs.nth(i).fill('1');
          }
        }

        // Click Verify OTP
        const verifyBtn = page.getByRole('button', { name: /verify & login|verify & sign in|verify otp|sign in|continue/i });
        const [verifyResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/auth/verify-otp')),
          verifyBtn.click(),
        ]);
        expect(verifyResponse.status(), 'POST /api/auth/verify-otp must succeed').toBe(200);

        // Verify redirect to citizen dashboard
        await page.waitForURL('**/citizen**', { timeout: 15000 });
        expect(page.url()).toContain('/citizen');

        outcome.assertClean();
      });

      test('2. Dashboard Filters & Search: status toggle & search query update list with 2xx responses', async ({
        page,
        context,
      }) => {
        const token = await createAuthJwt({
          sub: 'citizen_9876543210',
          role: 'CITIZEN',
          name: 'Bajrang Kumar',
          mobileNumber: '9876543210',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        await page.goto('/citizen');
        await page.waitForLoadState('domcontentloaded');

        // Verify dashboard search / filters loaded
        const searchInput = page.getByPlaceholder('Search title or ID...');
        await expect(searchInput).toBeVisible({ timeout: 10000 });

        // Test Search Filter
        const [searchRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/complaints') && r.url().includes('search=Pothole')),
          searchInput.fill('Pothole'),
        ]);
        expect(searchRes.status()).toBe(200);
        await page.waitForTimeout(500);

        // Clear search
        await searchInput.fill('');
        await page.waitForResponse((r) => r.url().includes('/api/complaints'));

        // Test Status Select Filter
        const statusSelect = page.locator('select').first();
        if (await statusSelect.isVisible()) {
          const [filterRes] = await Promise.all([
            page.waitForResponse((r) => r.url().includes('/api/complaints') && r.url().includes('status=RESOLVED')),
            statusSelect.selectOption('RESOLVED'),
          ]);
          expect(filterRes.status()).toBe(200);

          // Return to ALL
          await Promise.all([
            page.waitForResponse((r) => r.url().includes('/api/complaints')),
            statusSelect.selectOption('ALL'),
          ]);
        }

        outcome.assertClean();
      });

      test('3. File New Complaint: fill title, category, description, photo evidence -> creates complaint', async ({
        page,
        context,
      }) => {
        const token = await createAuthJwt({
          sub: 'citizen_9876543210',
          role: 'CITIZEN',
          name: 'Bajrang Kumar',
          mobileNumber: '9876543210',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        await page.goto('/citizen/complaints/new');
        await page.waitForLoadState('domcontentloaded');

        // Fill unique title
        const uniqueTitle = `Broken Water Valve Near East Gate ${Date.now()}`;
        const titleInput = page.locator('input#title');
        await expect(titleInput).toBeVisible({ timeout: 10000 });
        await titleInput.fill(uniqueTitle);

        // Wait for categories to load
        const categorySelect = page.locator('select#category:not([disabled])');
        await expect(categorySelect).toBeVisible({ timeout: 10000 });
        await categorySelect.selectOption('cat-water');

        // Description Validation (< 20 chars shows error)
        const descTextarea = page.locator('textarea#description');
        await descTextarea.fill('Too short');
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('text=min 20 characters').or(page.locator('text=at least 20 characters'))).toBeVisible();

        // Valid Description
        await descTextarea.fill('High-pressure municipal clean water leaking onto roadway and causing severe puddling.');

        // Attach Photo Evidence (using 1x1 test PNG)
        const fileInput = page.locator('input[type="file"][accept*="image"]').first();
        const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        await fileInput.setInputFiles({
          name: 'evidence.png',
          mimeType: 'image/png',
          buffer: testImageBuffer,
        });

        // Explicitly wait for photo evidence upload to complete and render preview
        await expect(page.locator('img[alt="Evidence 1"]')).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(1000);

        // Submit form (triggers duplicate check first)
        const submitBtn = page.locator('button[type="submit"]').first();
        await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/complaints/check-duplicate')),
          submitBtn.click(),
        ]);

        // If duplicate warning shows, click "This is Different, Submit Anyway"
        const submitAnywayBtn = page.getByRole('button', { name: /this is different, submit anyway/i });
        if (await submitAnywayBtn.isVisible()) {
          await submitAnywayBtn.click();
        }

        // Verify success card
        await expect(page.getByRole('heading', { name: /complaint submitted successfully/i })).toBeVisible({ timeout: 15000 });

        outcome.assertClean();
      });

      test('4. Complaint Deletion: pre-assignment complaint is deletable with modal confirm', async ({
        page,
        context,
      }) => {
        // Ensure cmp-submitted-demo is in SUBMITTED status
        await prisma.complaint.upsert({
          where: { id: 'cmp-submitted-demo' },
          update: { status: 'SUBMITTED' },
          create: {
            id: 'cmp-submitted-demo',
            ticketId: 'INC-2026-0903-0001',
            title: 'Water Leakage Near Sector 4 Market',
            description: 'Clean drinking water is continuously leaking from a municipal pipe joint.',
            status: 'SUBMITTED',
            priority: 'MEDIUM',
            citizenId: 'citizen_9876543210',
            categoryId: 'cat-water',
          },
        });

        const token = await createAuthJwt({
          sub: 'citizen_9876543210',
          role: 'CITIZEN',
          name: 'Bajrang Kumar',
          mobileNumber: '9876543210',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        await page.goto('/citizen/complaints/cmp-submitted-demo');
        await page.waitForLoadState('domcontentloaded');

        // Locate Delete Complaint button
        const deleteBtn = page.getByRole('button', { name: /delete complaint/i });
        await expect(deleteBtn).toBeVisible({ timeout: 10000 });

        // Handle confirmation dialog
        page.once('dialog', async (dialog) => {
          expect(dialog.message()).toContain('Are you sure you want to delete this complaint');
          await dialog.accept();
        });

        const [delRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/complaints/cmp-submitted-demo') && r.request().method() === 'DELETE'),
          deleteBtn.click(),
        ]);
        expect(delRes.status()).toBe(200);

        // Verify redirect to dashboard
        await page.waitForURL('**/citizen', { timeout: 10000 });

        // Verify complaint removed from DB
        const dbCheck = await prisma.complaint.findUnique({ where: { id: 'cmp-submitted-demo' } });
        expect(dbCheck).toBeNull();

        outcome.assertClean();
      });

      test('5. Rating & Reopen on Resolved Complaint: delete disabled, star rating works, reopen works', async ({
        page,
        context,
      }) => {
        // Ensure cmp-resolved-demo is in RESOLVED status
        await prisma.complaint.upsert({
          where: { id: 'cmp-resolved-demo' },
          update: { status: 'RESOLVED', readyForReview: false },
          create: {
            id: 'cmp-resolved-demo',
            ticketId: 'INC-2026-0901-1001',
            title: 'Pothole on Main Street',
            description: 'Deep asphalt pothole near Signal 4 causing traffic congestion.',
            status: 'RESOLVED',
            priority: 'HIGH',
            citizenId: 'citizen_9876543210',
            categoryId: 'cat-roads',
            departmentId: 'dept_roads_infra',
            resolvedAt: new Date(),
          },
        });

        const token = await createAuthJwt({
          sub: 'citizen_9876543210',
          role: 'CITIZEN',
          name: 'Bajrang Kumar',
          mobileNumber: '9876543210',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        await page.goto('/citizen/complaints/cmp-resolved-demo');
        await page.waitForLoadState('domcontentloaded');

        // Edge flow: Verify Delete Complaint button is NOT visible for resolved complaint
        const deleteBtn = page.getByRole('button', { name: /delete complaint/i });
        await expect(deleteBtn).not.toBeVisible();

        // 5.1 Test Star Rating & Feedback
        const feedbackComment = page.locator('textarea#feedback-comment, textarea[placeholder*="feedback" i], textarea[placeholder*="experience" i]').first();
        if (await feedbackComment.isVisible()) {
          await feedbackComment.fill('Excellent and timely road repair work completed.');
          const submitFeedbackBtn = page.getByRole('button', { name: /submit feedback|submit rating/i });
          const [feedbackRes] = await Promise.all([
            page.waitForResponse((r) => r.url().includes('/feedback') && r.request().method() === 'POST'),
            submitFeedbackBtn.click(),
          ]);
          expect(feedbackRes.status()).toBe(200);
        }

        // 5.2 Test Reopen Complaint Flow
        const reopenBtn = page.getByRole('button', { name: /reopen complaint|issue not resolved/i }).first();
        if (await reopenBtn.isVisible()) {
          await reopenBtn.click();

          // Modal should open
          const reasonInput = page.locator('textarea[placeholder*="reopen" i], textarea#reopen-reason').first();
          await expect(reasonInput).toBeVisible();

          // Fill reason (> 10 chars)
          await reasonInput.fill('Pothole reopened after heavy rain, needs complete leveling.');

          const confirmReopenBtn = page.getByRole('button', { name: /confirm reopen|submit reopen/i });
          const [reopenRes] = await Promise.all([
            page.waitForResponse((r) => r.url().includes('/reopen') && r.request().method() === 'POST'),
            confirmReopenBtn.click(),
          ]);
          expect(reopenRes.status()).toBe(200);

          // Verify updated status in UI
          await expect(page.locator('text=REOPENED').or(page.locator('text=Reopened')).first()).toBeVisible({ timeout: 10000 });
        }

        outcome.assertClean();
      });

      test('6. Profile Management: edit citizen details and save', async ({ page, context }) => {
        const token = await createAuthJwt({
          sub: 'citizen_9876543210',
          role: 'CITIZEN',
          name: 'Bajrang Kumar',
          mobileNumber: '9876543210',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        await page.goto('/citizen/profile');
        await page.waitForLoadState('domcontentloaded');

        // Update name and address
        const nameInput = page.locator('input#name');
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        await nameInput.fill('Bajrang Kumar Verified');

        const addressInput = page.locator('textarea#address');
        await expect(addressInput).toBeVisible({ timeout: 10000 });
        await addressInput.fill('Sector 4, Main Municipal District, Smart City');

        const saveBtn = page.getByRole('button', { name: /save changes|save & continue|update profile/i }).first();
        const [profileRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/citizen/profile') && r.request().method() === 'PUT'),
          saveBtn.click(),
        ]);
        expect(profileRes.status()).toBe(200);

        outcome.assertClean();
      });

      test('7. Notifications & Logout: mark all notifications as read and sign out', async ({ page, context }) => {
        const token = await createAuthJwt({
          sub: 'citizen_9876543210',
          role: 'CITIZEN',
          name: 'Bajrang Kumar',
          mobileNumber: '9876543210',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        await page.goto('/citizen/notifications');
        await page.waitForLoadState('domcontentloaded');

        // Mark All Read if button is present
        const markAllBtn = page.getByRole('button', { name: /mark all as read/i });
        if (await markAllBtn.isVisible()) {
          const [markRes] = await Promise.all([
            page.waitForResponse((r) => r.url().includes('/api/notifications') && r.request().method() === 'PATCH'),
            markAllBtn.click(),
          ]);
          expect(markRes.status()).toBe(200);
        }

        // Click Sign Out
        const signOutBtn = page.getByRole('button', { name: /sign out|log out/i }).or(page.locator('button:has-text("Sign Out")')).first();
        if (await signOutBtn.isVisible()) {
          await signOutBtn.click();
          await page.waitForURL(/(\/login|\/login\/citizen)/, { timeout: 10000 });
        }

        outcome.assertClean();
      });
    });
  }
});
