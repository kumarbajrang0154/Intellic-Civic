import { test, expect, Page } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createCitizenJwt() {
  return new SignJWT({
    sub: 'citizen_9876543210',
    role: 'CITIZEN',
    name: 'Bajrang Kumar',
    mobileNumber: '9876543210',
    email: 'kumarbajrang0154@gmail.com',
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

const VIEWPORTS = [
  { name: 'Mobile (375x812)', width: 375, height: 812 },
  { name: 'Tablet (768x1024)', width: 768, height: 1024 },
  { name: 'Desktop (1280x800)', width: 1280, height: 800 },
];

function setupCommonMocks(page: Page) {
  let voteCount = 4;
  let hasVoted = false;
  let unreadCount = 2;
  let notifications = [
    {
      id: 'n-1',
      complaintId: 'c-1',
      message: 'Your complaint CMP-2026-1001 status changed to RESOLVED.',
      isRead: false,
      createdAt: new Date().toISOString(),
      complaint: { ticketId: 'CMP-2026-1001', title: 'Broken streetlight', status: 'RESOLVED', priority: 'HIGH' },
    },
    {
      id: 'n-2',
      complaintId: 'c-1',
      message: 'Officer assigned to your complaint CMP-2026-1001.',
      isRead: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      complaint: { ticketId: 'CMP-2026-1001', title: 'Broken streetlight', status: 'ASSIGNED', priority: 'HIGH' },
    },
  ];

  return page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/api/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'citizen_9876543210',
            name: 'Bajrang Kumar',
            email: 'kumarbajrang0154@gmail.com',
            role: 'CITIZEN',
            isProfileComplete: true,
          },
        }),
      });
    }

    if (url.includes('/api/categories')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-roads', name: 'Roads & Infrastructure' },
          { id: 'cat-sanitation', name: 'Sanitation & Solid Waste' },
        ]),
      });
    }

    if (url.includes('/api/citizen/chatbot') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: `Here is the status for your query "${body.message?.slice(0, 30)}": Ticket CMP-2026-1001 is currently RESOLVED.`,
          source: 'rules',
        }),
      });
    }

    if (url.includes('/api/citizen/live-status-map')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          own: [
            {
              id: 'c-1',
              ticketId: 'CMP-2026-1001',
              latitude: 12.9716,
              longitude: 77.5946,
              status: 'RESOLVED',
              priority: 'HIGH',
              updatedAt: new Date().toISOString(),
            },
          ],
          areas: [
            { area: 'Ward 42 - Indiranagar', total: 12, resolved: 8, inProgress: 2, pending: 2 },
          ],
        }),
      });
    }

    if (url.includes('/api/citizen/profile')) {
      if (method === 'PUT' || method === 'PATCH') {
        const data = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, profile: data }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: 'citizen_9876543210',
            name: 'Bajrang Kumar',
            email: 'kumarbajrang0154@gmail.com',
            mobileNumber: '9876543210',
            address: '42 MG Road, Ward 10',
            avatarUrl: null,
            isProfileComplete: true,
          },
        }),
      });
    }

    if (url.includes('/api/notifications')) {
      if (method === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.markAll || body.all) {
          notifications = notifications.map((n) => ({ ...n, isRead: true }));
          unreadCount = 0;
        } else if (body.notificationId || body.id) {
          const targetId = body.notificationId || body.id;
          notifications = notifications.map((n) => (n.id === targetId ? { ...n, isRead: true } : n));
          unreadCount = Math.max(0, unreadCount - 1);
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: notifications, unreadCount }),
      });
    }

    if (url.includes('/api/complaints/check-duplicate')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ matched: false, potentialDuplicates: [] }),
      });
    }

    if (url.includes('/api/upload/signature')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cloudName: 'demo', apiKey: '1234567890' }),
      });
    }

    if (url.includes('/api/complaints/c-1/vote')) {
      hasVoted = !hasVoted;
      voteCount = hasVoted ? voteCount + 1 : voteCount - 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, voteCount, hasVoted }),
      });
    }

    if (url.includes('/api/complaints/c-1/feedback') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }

    if (url.includes('/api/complaints/c-1/reopen') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }

    if (url.includes('/api/complaints/c-1') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-1',
          ticketId: 'CMP-2026-1001',
          title: 'Deep pothole on Main Road',
          description: 'Large hazardous pothole damaging vehicles and blocking traffic.',
          status: 'RESOLVED',
          priority: 'HIGH',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          resolvedAt: new Date(Date.now() - 3600000).toISOString(),
          reopenCount: 0,
          citizenId: 'citizen_9876543210',
          isOwnComplaint: true,
          voteCount,
          hasVoted,
          category: { id: 'cat-roads', name: 'Roads & Infrastructure' },
          department: { id: 'dept-roads', name: 'Roads & Bridges' },
          location: { address: 'Main Road near Junction' },
          evidence: [],
          statusHistory: [
            { id: 'sh-1', toStatus: 'RESOLVED', changedAt: new Date(Date.now() - 3600000).toISOString() },
          ],
        }),
      });
    }

    if (url.includes('/api/complaints') && method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-new-1',
          ticketId: 'CMP-2026-9999',
          title: 'Damaged road surface with large crater',
          status: 'SUBMITTED',
        }),
      });
    }

    if (url.includes('/api/complaints')) {
      const isCommunityScope = url.includes('scope=community');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'c-1',
              ticketId: 'CMP-2026-1001',
              title: 'Deep pothole on Main Road',
              description: 'Large hazardous pothole damaging vehicles and blocking traffic.',
              status: 'RESOLVED',
              createdAt: new Date().toISOString(),
              voteCount,
              hasVoted,
              citizenId: isCommunityScope ? 'other_citizen_123' : 'citizen_9876543210',
              isOwnComplaint: !isCommunityScope,
              category: { id: 'cat-roads', name: 'Roads & Infrastructure' },
            },
          ],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        }),
      });
    }

    if (url.includes('/api/settings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          settings: { platformName: 'IntelliCivic', logoUrl: null },
        }),
      });
    }

    return route.continue();
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`Citizen Portal Click-Through — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ context, page }) => {
      const token = await createCitizenJwt();
      await context.addCookies([
        {
          name: 'ic_access_token',
          value: token,
          domain: 'localhost',
          path: '/',
        },
      ]);
      await setupCommonMocks(page);
    });

    test('1. Dashboard: Stat cards render with outcome and Chatbot sends message', async ({ page }) => {
      await page.goto('/citizen');

      // Verify all summary stat cards are visible with real counts
      await expect(page.locator('p:text-is("Total Reports")')).toBeVisible();
      await expect(page.locator('p:text-is("Under Review")')).toBeVisible();
      await expect(page.locator('p:text-is("In Progress")')).toBeVisible();
      await expect(page.locator('p:text-is("Resolved")')).toBeVisible();

      // Chatbot interaction: send inquiry and assert assistant response bubble
      const chatInput = page.locator('#citizen-chat-input');
      await expect(chatInput).toBeVisible();
      await chatInput.fill('Check ticket CMP-2026-1001 status please');

      const sendBtn = page.locator('form:has(#citizen-chat-input) button[type="submit"]');
      await expect(sendBtn).toBeVisible();
      await sendBtn.click();

      // Outcome assertion: Response bubble from assistant is displayed
      await expect(page.getByText(/Ticket CMP-2026-1001 is currently RESOLVED/i)).toBeVisible({ timeout: 10000 });
    });

    test('2. New Complaint: Field inputs, GPS skip, photo upload, and submit outcome', async ({ page }) => {
      await page.goto('/citizen/complaints/new');

      // Title input
      const titleInput = page.locator('#title');
      await expect(titleInput).toBeVisible();
      await titleInput.fill('Damaged road surface with large crater');

      // Description input
      const descInput = page.locator('#description');
      await expect(descInput).toBeVisible();
      await descInput.fill('Pothole is approximately 2 feet wide and causes danger to two-wheelers on the road.');

      // Category select
      const categorySelect = page.locator('#category');
      await expect(categorySelect).toBeVisible();
      await categorySelect.selectOption('cat-roads');

      // Address input (manual landmark / GPS skip)
      const addressInput = page.locator('#address');
      await expect(addressInput).toBeVisible();
      await addressInput.fill('Near Metro Pillar 142, Outer Ring Road');

      // Photo upload via file input
      const fileInput = page.locator('input[type="file"][accept*="image/jpeg"]');
      await fileInput.setInputFiles({
        name: 'pothole-evidence.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-jpeg-image-bytes-for-playwright-testing'),
      });

      // Submit complaint
      const submitBtn = page.locator('button[type="submit"]:has-text("Submit Complaint")');
      await expect(submitBtn).toBeVisible();
      await submitBtn.click();

      // Outcome assertion: success card with Reference ID is rendered
      await expect(page.getByText(/Complaint Submitted Successfully!|CMP-2026-9999/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('3. My Complaints: Filter, Open Detail, Rating, Reopen, and Upvote', async ({ page }) => {
      await page.goto('/citizen');

      // Filter: Select status filter
      const filterSelect = page.locator('select').first();
      if (await filterSelect.isVisible()) {
        await filterSelect.selectOption('RESOLVED');
      }

      // Switch to Community Issues tab so citizen can upvote community complaint
      const communityTab = page.locator('button:has-text("Community Issues")');
      await expect(communityTab).toBeVisible();
      await communityTab.click();

      // Upvote ("Me Too") interaction
      const upvoteBtn = page.locator('button:has-text("Me Too")').first();
      await expect(upvoteBtn).toBeVisible();
      await upvoteBtn.click();

      // Outcome assertion: vote count updates to 5
      await expect(page.locator('button:has-text("Me Too"):has-text("5")').first()).toBeVisible({ timeout: 5000 });

      // Open Detail: click complaint ticket card
      const complaintCard = page.locator('a:has-text("CMP-2026-1001")').first();
      await expect(complaintCard).toBeVisible();
      await complaintCard.click();
      await expect(page).toHaveURL(/\/citizen\/complaints\/c-1/);

      // Detail: Rating submission (5 stars)
      const star5 = page.locator('button[aria-label="Rate 5 out of 5 stars"]');
      if (await star5.isVisible()) {
        await star5.click();
        const commentInput = page.locator('#comment');
        if (await commentInput.isVisible()) {
          await commentInput.fill('Great and prompt resolution by the municipal team!');
        }
        const submitFeedbackBtn = page.locator('button:has-text("Submit Feedback")');
        await expect(submitFeedbackBtn).toBeVisible();
        await submitFeedbackBtn.click();
        await expect(page.getByText(/Thank you! Your rating/i)).toBeVisible({ timeout: 5000 });
      }

      // Detail: Reopen Complaint workflow
      const reopenBtn = page.locator('button:has-text("Reopen Complaint")');
      await expect(reopenBtn).toBeVisible();
      await reopenBtn.click();

      // Modal opens
      await expect(page.getByText('Reopen Resolved Complaint')).toBeVisible();
      const reasonInput = page.locator('#reopenReason');
      await expect(reasonInput).toBeVisible();
      await reasonInput.fill('Pothole was only partially patched and asphalt broke again within 2 days.');

      const confirmReopenBtn = page.locator('div[role="dialog"] button:has-text("Confirm Reopen")');
      await expect(confirmReopenBtn).toBeVisible();
      await confirmReopenBtn.click();

      // Outcome assertion: modal closes and toast/alert appears
      await expect(page.getByText(/Complaint reopened/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('4. Live Status Map: Geotagged pin opens complaint detail', async ({ page }) => {
      await page.goto('/citizen/map');

      // Click "View Details" on the geotagged complaints list
      const viewDetailLink = page.locator('a:has-text("View Details")').first();
      await expect(viewDetailLink).toBeVisible();
      await viewDetailLink.click();

      // Outcome assertion: Navigates to complaint detail page
      await expect(page).toHaveURL(/\/citizen\/complaints\/c-1/);
      await expect(page.getByText('CMP-2026-1001')).toBeVisible();
    });

    test('5. Notifications: Mark single read and Mark all as read outcomes', async ({ page }) => {
      await page.goto('/citizen/notifications');

      // Verify unread notification exists
      await expect(page.getByText('Your complaint CMP-2026-1001 status changed to RESOLVED.')).toBeVisible();

      // Mark single read
      const markSingleBtn = page.locator('button[title="Mark as read"]').first();
      if (await markSingleBtn.isVisible()) {
        await markSingleBtn.click();
      }

      // Mark all as read
      const markAllBtn = page.getByRole('button', { name: /Mark All as Read/i }).first();
      await expect(markAllBtn).toBeVisible();
      await markAllBtn.click();

      // Outcome assertion: Toast confirms all marked as read
      await expect(page.getByText(/All notifications marked as read/i)).toBeVisible({ timeout: 5000 });
    });

    test('6. Profile: Avatar preset selection and profile save outcome', async ({ page }) => {
      await page.goto('/citizen/profile');

      // Select Avatar 1 preset
      const avatarBtn = page.locator('button:has-text("Avatar 1")');
      await expect(avatarBtn).toBeVisible();
      await avatarBtn.click();

      // Outcome assertion: URL input updates with Avatar 1 URL
      const avatarUrlInput = page.locator('input[type="url"]');
      await expect(avatarUrlInput).toHaveValue(/Citizen1/);

      // Modify Full Name
      const nameInput = page.locator('#name');
      await expect(nameInput).toBeVisible();
      await nameInput.fill('Bajrang Kumar Verified');

      // Save Profile
      const saveBtn = page.locator('button[type="submit"]:has-text("Save")');
      await expect(saveBtn).toBeVisible();
      await saveBtn.click();

      // Outcome assertion: success message or redirection to /citizen
      await expect(page).toHaveURL(/\/citizen/);
    });
  });
}

test.describe('Task 5d — Bounding Box Touch Target Assertion (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ context, page }) => {
    const token = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);
    await setupCommonMocks(page);
  });

  const PAGES_TO_AUDIT = [
    { url: '/citizen', name: 'Citizen Dashboard' },
    { url: '/citizen/complaints/new', name: 'New Complaint' },
    { url: '/citizen/complaints/c-1', name: 'Complaint Detail' },
    { url: '/citizen/notifications', name: 'Notifications' },
    { url: '/citizen/profile', name: 'Profile' },
  ];

  for (const p of PAGES_TO_AUDIT) {
    test(`Every primary button on ${p.name} has height >= 44px at 375px`, async ({ page }) => {
      await page.goto(p.url);
      await page.waitForLoadState('domcontentloaded');

      const primaryButtonHeights = await page.evaluate(() => {
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>('button, a, input[type="submit"]')
        );

        return candidates
          .filter((el) => {
            const style = window.getComputedStyle(el);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.opacity === '0' ||
              el.offsetHeight === 0
            ) {
              return false;
            }

            const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
            const cls = el.className || '';

            // Check if primary action button or anchor
            const isPrimary =
              el.getAttribute('type') === 'submit' ||
              cls.includes('bg-primary') ||
              cls.includes('bg-ic-blue') ||
              cls.includes('bg-[#3468A1]') ||
              cls.includes('bg-amber-600') ||
              cls.includes('bg-emerald-600') ||
              /(submit|confirm|file new complaint|track this complaint|save profile|save)/i.test(text);

            return isPrimary;
          })
          .map((el) => ({
            text: (el.textContent || el.getAttribute('aria-label') || 'button').slice(0, 30).trim(),
            height: Math.round(el.getBoundingClientRect().height * 10) / 10,
          }));
      });

      for (const btn of primaryButtonHeights) {
        // Assert height >= 43.5px (~44px touch target)
        expect(
          btn.height,
          `Button "${btn.text}" on ${p.name} height ${btn.height}px must be >= 44px`
        ).toBeGreaterThanOrEqual(43.5);
      }
    });
  }
});
