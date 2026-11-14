import { test, expect, Page } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createCitizenJwt() {
  return new SignJWT({
    sub: 'citizen_owner_1',
    role: 'CITIZEN',
    name: 'Citizen Tester',
    mobileNumber: '9876543210',
    email: 'tester.citizen@smartcity.gov.in',
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

function setupMockApi(page: Page) {
  let voteState = { voted: false, count: 5 };
  let ownerState = {
    reopened: false,
    feedback: null as any,
  };

  return page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/api/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'citizen_owner_1',
            name: 'Citizen Tester',
            mobileNumber: '9876543210',
            role: 'CITIZEN',
          },
        }),
      });
    }

    // --- Vote Mock Complaint (/api/complaints/cmp-vote-test) ---
    if (url.includes('/api/complaints/cmp-vote-test/vote')) {
      voteState.voted = !voteState.voted;
      voteState.count = voteState.voted ? voteState.count + 1 : voteState.count - 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          voted: voteState.voted,
          voteCount: voteState.count,
        }),
      });
    }

    if (url.includes('/api/complaints/cmp-vote-test')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cmp-vote-test',
          ticketId: 'IC-2026-VOTE1',
          title: 'Damaged Drainage Cover on Cross Cut Road',
          description: 'Deep open hole on pedestrian walkway posing severe injury risk.',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          category: { id: 'cat-1', name: 'Water Supply & Sanitation' },
          department: { id: 'dept-1', name: 'Water Supply' },
          createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          citizenId: 'other_citizen_user', // not citizen_owner_1, so user can vote
          isOwnComplaint: false,
          voteCount: voteState.count,
          hasVoted: voteState.voted,
          reopenCount: 0,
          evidence: [],
          timeline: [],
        }),
      });
    }

    // --- Owner Mock Complaint (/api/complaints/cmp-owner-test) ---
    if (url.includes('/api/complaints/cmp-owner-test/feedback') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      ownerState.feedback = {
        id: 'fb-owner-1',
        rating: body.rating || 5,
        comment: body.comment || 'Great resolution!',
        createdAt: new Date().toISOString(),
      };
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Feedback submitted successfully.',
          feedback: ownerState.feedback,
        }),
      });
    }

    if (url.includes('/api/complaints/cmp-owner-test/reopen') && method === 'POST') {
      ownerState.reopened = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Complaint reopened and routed back to department.',
          complaint: {
            id: 'cmp-owner-test',
            ticketId: 'IC-2026-OWNER1',
            status: 'IN_PROGRESS',
            reopenCount: 1,
          },
        }),
      });
    }

    if (url.includes('/api/complaints/cmp-owner-test')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cmp-owner-test',
          ticketId: 'IC-2026-OWNER1',
          title: 'Broken Streetlamp outside Municipal Park',
          description: 'Streetlamp pole wiring damaged, area completely dark at night.',
          status: ownerState.reopened ? 'IN_PROGRESS' : 'RESOLVED',
          priority: 'MEDIUM',
          category: { id: 'cat-2', name: 'Electrical & Street Lighting' },
          department: { id: 'dept-2', name: 'Electrical' },
          createdAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
          resolvedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          citizenId: 'citizen_owner_1',
          isOwnComplaint: true,
          voteCount: 3,
          hasVoted: false,
          reopenCount: ownerState.reopened ? 1 : 0,
          feedback: ownerState.feedback,
          evidence: [],
          timeline: [],
        }),
      });
    }

    return route.continue();
  });
}

test.describe('Task 8f — Browser: Rating, Reopen Confirm and Vote Buttons at 375px and 1280px', () => {
  const viewports = [
    { name: 'Mobile (375px)', width: 375, height: 667 },
    { name: 'Desktop (1280px)', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    test(`Vote, rating, and reopen confirm buttons work at ${vp.name}`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupMockApi(page);

      const token = await createCitizenJwt();
      await context.addCookies([
        {
          name: 'ic_access_token',
          value: token,
          domain: 'localhost',
          path: '/',
        },
      ]);

      // 1. Test Vote Button on supporter complaint
      await page.goto('http://localhost:3000/citizen/complaints/cmp-vote-test', { waitUntil: 'domcontentloaded' });

      const voteButton = page.locator('button[aria-label*="Upvote this complaint"]').first();
      await expect(voteButton).toBeVisible({ timeout: 10000 });
      await expect(voteButton).toBeEnabled();
      // Verify initial aria-pressed reflects unvoted state (false)
      await expect(voteButton).toHaveAttribute('aria-pressed', 'false');

      console.log(`[8f ${vp.name}] Clicking Vote button (POST)...`);
      await voteButton.click();
      await page.waitForTimeout(500);

      // Verify button reflects active vote count (incremented from 5 to 6) and aria-pressed is true after POST
      const unvoteButton = page.locator('button[aria-label*="Remove Me Too vote"]').first();
      await expect(unvoteButton).toBeVisible();
      await expect(unvoteButton).toHaveAttribute('aria-pressed', 'true');
      const voteText = await unvoteButton.innerText();
      console.log(`[8f ${vp.name}] Vote Button Text after POST click:`, voteText.trim());
      expect(voteText).toContain('6');

      // Click again to unvote (DELETE)
      console.log(`[8f ${vp.name}] Clicking Vote button again (DELETE)...`);
      await unvoteButton.click();
      await page.waitForTimeout(500);

      // Verify button returns to unvoted state with aria-pressed="false" after DELETE
      const revoteButton = page.locator('button[aria-label*="Upvote this complaint"]').first();
      await expect(revoteButton).toBeVisible();
      await expect(revoteButton).toHaveAttribute('aria-pressed', 'false');
      const revoteText = await revoteButton.innerText();
      expect(revoteText).toContain('5');

      // 2. Test Feedback Rating and Reopen on owner complaint
      await page.goto('http://localhost:3000/citizen/complaints/cmp-owner-test', { waitUntil: 'domcontentloaded' });

      // Feedback form: Click Star 5
      const star5Button = page.getByRole('button', { name: 'Rate 5 out of 5 stars' }).first();
      await expect(star5Button).toBeVisible({ timeout: 10000 });
      await star5Button.click();

      // Submit feedback
      const submitFeedbackBtn = page.getByRole('button', { name: 'Submit Feedback' });
      await expect(submitFeedbackBtn).toBeVisible();
      console.log(`[8f ${vp.name}] Submitting Rating & Feedback...`);
      await submitFeedbackBtn.click();
      await page.waitForTimeout(500);

      // Verify feedback submitted message or read-only view
      await expect(
        page.locator('text=Thank you! Your rating and comments have been recorded.').first(),
      ).toBeVisible({ timeout: 5000 });
      console.log(`[8f ${vp.name}] Feedback confirmed successfully.`);

      // 3. Test Reopen Complaint and Confirm Reopen
      const reopenButton = page.getByRole('button', { name: /Reopen Complaint/i });
      await expect(reopenButton).toBeVisible({ timeout: 5000 });
      console.log(`[8f ${vp.name}] Opening Reopen modal...`);
      await reopenButton.click();

      // Modal dialog appears
      const reasonTextarea = page.locator('#reopenReason');
      await expect(reasonTextarea).toBeVisible({ timeout: 5000 });
      await reasonTextarea.fill('The streetlamp flickers and goes dark intermittently during night.');

      const confirmReopenBtn = page.getByRole('button', { name: 'Confirm Reopen' });
      await expect(confirmReopenBtn).toBeVisible();
      console.log(`[8f ${vp.name}] Clicking Confirm Reopen button...`);
      await confirmReopenBtn.click();
      await page.waitForTimeout(500);

      // Verify success notification or reopened status
      await expect(
        page.locator('text=Complaint reopened and routed back').first(),
      ).toBeVisible({ timeout: 5000 });
      console.log(`[8f ${vp.name}] Reopen confirmed successfully.`);
    });
  }
});
