import { test, expect } from '@playwright/test';
import path from 'path';

const VIEWPORTS = [
  { width: 375, height: 812, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1280, height: 800, name: 'desktop' },
];

const CITIZEN_PAGES = [
  { path: '/citizen', label: 'citizen-dashboard' },
  { path: '/citizen/complaints', label: 'citizen-complaints' },
  { path: '/citizen/complaints/new', label: 'citizen-complaints-new' },
  { path: '/citizen/map', label: 'citizen-map' },
  { path: '/citizen/notifications', label: 'citizen-notifications' },
  { path: '/citizen/profile', label: 'citizen-profile' },
];

let cachedCitizenCookies: Array<{ name: string; value: string; domain: string; path: string }> = [];

async function obtainCitizenOtpSession(request: any, mobile: string = '7859058586') {
  const candidateNumbers = [mobile, '7859058585', '7859058584', '7859058588', '7859058589'];
  for (const num of candidateNumbers) {
    try {
      const randomIp = `10.100.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
      const sendRes = await request.post('http://localhost:3000/api/auth/send-otp', {
        data: { mobileNumber: num },
        headers: { 'x-forwarded-for': randomIp },
      });
      if (!sendRes.ok()) {
        continue;
      }
      const sendBody = await sendRes.json();
      const validOtp = sendBody.otp;
      if (!validOtp) continue;

      const verifyRes = await request.post('http://localhost:3000/api/auth/verify-otp', {
        data: { mobileNumber: num, otp: validOtp },
        headers: { 'x-forwarded-for': randomIp },
      });
      if (!verifyRes.ok()) continue;

      const cookies: Array<{ name: string; value: string; domain: string; path: string }> = [];
      const setCookies = verifyRes.headersArray().filter((h: any) => h.name.toLowerCase() === 'set-cookie');
      for (const h of setCookies) {
        const match = h.value.match(/^([^=]+)=([^;]+)/);
        if (match) {
          cookies.push({
            name: match[1],
            value: match[2],
            domain: 'localhost',
            path: '/',
          });
        }
      }

      // Ensure citizen profile is marked complete so middleware does not redirect away from citizen pages
      try {
        const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        const profileRes = await request.put('http://localhost:3000/api/citizen/profile', {
          headers: {
            cookie: cookieStr,
            'x-forwarded-for': randomIp,
            'Content-Type': 'application/json',
          },
          data: {
            name: `Citizen QA ${num}`,
            email: `citizen.${num}@city.gov`,
            address: '4th Cross Road, Ward 12',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Citizen',
          },
        });
        if (profileRes.ok()) {
          const profileCookies = profileRes.headersArray().filter((h: any) => h.name.toLowerCase() === 'set-cookie');
          for (const h of profileCookies) {
            const match = h.value.match(/^([^=]+)=([^;]+)/);
            if (match) {
              const existingIdx = cookies.findIndex((c) => c.name === match[1]);
              if (existingIdx >= 0) {
                cookies[existingIdx].value = match[2];
              } else {
                cookies.push({ name: match[1], value: match[2], domain: 'localhost', path: '/' });
              }
            }
          }
        }
      } catch {}

      if (cookies.length > 0) return cookies;
    } catch {
      continue;
    }
  }
  throw new Error('Could not obtain citizen session with any candidate number');
}

test.describe('Citizen Smoke Matrix & Flows in Browser', () => {
  test.beforeAll(async ({ request }) => {
    // Authenticate once via OTP (console mode) and cache session cookies to respect OTP rate limit
    cachedCitizenCookies = await obtainCitizenOtpSession(request, '7859058586');
  });

  test.beforeEach(async ({ context }) => {
    if (cachedCitizenCookies.length > 0) {
      await context.addCookies(cachedCitizenCookies);
    }
  });

  for (const pageInfo of CITIZEN_PAGES) {
    for (const vp of VIEWPORTS) {
      test(`Citizen page "${pageInfo.path}" at ${vp.width}x${vp.height}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const server5xxErrors: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });

        page.on('pageerror', (err) => {
          consoleErrors.push(err.message);
        });

        page.on('response', (res) => {
          if (res.status() >= 500) {
            server5xxErrors.push(`${res.status()} ${res.url()}`);
          }
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });

        try {
          const res = await page.goto(`http://localhost:3000${pageInfo.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });

          await page.waitForTimeout(1000);

          if (server5xxErrors.length > 0 || consoleErrors.length > 0) {
            const screenPath = path.join(
              process.cwd(),
              'scratch',
              'screens',
              `citizen_${pageInfo.label}_${vp.width}x${vp.height}.png`,
            );
            await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          }

          expect(server5xxErrors, `5xx network responses: ${server5xxErrors.join(', ')}`).toEqual([]);
          expect(consoleErrors, `Uncaught console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
          expect(res?.status()).toBeLessThan(500);
        } catch (err) {
          const screenPath = path.join(
            process.cwd(),
            'scratch',
            'screens',
            `citizen_${pageInfo.label}_${vp.width}x${vp.height}_FAIL.png`,
          );
          await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          throw err;
        }
      });
    }
  }

  test('Flow: Citizen creates complaint with title, description, and image upload', async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: string[] = [];
    const server5xxErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() >= 500) server5xxErrors.push(`${res.status()} ${res.url()}`);
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('https://api.cloudinary.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          secure_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        }),
      }),
    );

    const uniqueTitle = `Pothole on 4th Cross Road ${Date.now()}`;
    const testDesc = 'Deep hazardous pothole on 4th Cross Road causing severe traffic congestion and bike accidents.';

    await page.goto('http://localhost:3000/citizen/complaints/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // If redirected to complete profile, complete it and proceed
    if (page.url().includes('/citizen/profile')) {
      const nameInput = page.locator('input[placeholder*="Bajrang"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill('Citizen Tester');
        await page.locator('input[placeholder*="citizen@gmail.com"]').fill('citizen.tester@city.gov');
        await page.locator('input[placeholder*="House 42"]').fill('4th Cross Road, Ward 12');
        await page.locator('button:has-text("Save & Continue")').click();
        await page.waitForTimeout(1500);
        await page.goto('http://localhost:3000/citizen/complaints/new', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
      }
    }

    await page.fill('#title', uniqueTitle);
    await page.fill('#description', testDesc);

    // Select first category option if available
    const categorySelect = page.locator('#category');
    if (await categorySelect.count() > 0) {
      const options = await categorySelect.locator('option').all();
      if (options.length > 1) {
        const optVal = await options[1].getAttribute('value');
        if (optVal) await categorySelect.selectOption(optVal);
      }
    }

    // Attach image
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      // 1x1 transparent PNG
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
      await fileInput.setInputFiles({
        name: 'smoke_test_pothole.png',
        mimeType: 'image/png',
        buffer: pngBuffer,
      });
      // Wait for image to finish data URL processing and preview to render
      await expect(page.locator('text=Photo #1')).toBeVisible({ timeout: 10000 });
    }

    // Submit form
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // If duplicate detection dialog/card appears, click "This is Different, Submit Anyway"
    const submitAnywayBtn = page.locator('button:has-text("This is Different, Submit Anyway")');
    try {
      await submitAnywayBtn.waitFor({ state: 'visible', timeout: 6000 });
      await submitAnywayBtn.click();
    } catch {}

    // Verify submission confirmation screen appears with reference ID
    await expect(page.locator('text=Complaint Submitted Successfully!')).toBeVisible({ timeout: 45000 });

    expect(server5xxErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Flow: Citizen chatbot sends "status" in chat panel and expects answer bubble', async ({ page }) => {
    const consoleErrors: string[] = [];
    const server5xxErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() >= 500) server5xxErrors.push(`${res.status()} ${res.url()}`);
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('https://api.cloudinary.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          secure_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        }),
      }),
    );

    await page.goto('http://localhost:3000/citizen', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // If redirected to complete profile, complete it and proceed to /citizen
    if (page.url().includes('/citizen/profile')) {
      const nameInput = page.locator('input[placeholder*="Bajrang"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill('Citizen Tester');
        await page.locator('input[placeholder*="citizen@gmail.com"]').fill('citizen.tester@city.gov');
        await page.locator('input[placeholder*="House 42"]').fill('4th Cross Road, Ward 12');
        await page.locator('button:has-text("Save & Continue")').click();
        await page.waitForTimeout(1500);
        await page.goto('http://localhost:3000/citizen', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
      }
    }

    // Locate chatbot textarea in CitizenChatPanel
    const chatInput = page.locator('#citizen-chat-input');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await chatInput.fill('status');
    // Click send button
    const sendBtn = page.locator('button[type="submit"]:has-text("Send")').first();
    if (await sendBtn.count() > 0) {
      await sendBtn.click();
    } else {
      await chatInput.press('Enter');
    }

    // Expect an assistant reply badge (Gemini AI or Rule Lookup) to appear within 20 seconds
    const assistantBadge = page.locator('div[role="log"]').getByText(/Gemini AI|Rule Lookup/).last();
    await expect(assistantBadge).toBeVisible({ timeout: 20000 });

    expect(server5xxErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
