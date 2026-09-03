import { test, expect } from '@playwright/test';

test.describe('PWA Manifest & Service Worker Tests', () => {
  const baseURL = 'http://localhost:3000';

  test('1. GET /manifest.webmanifest returns valid Next.js App Router Web Manifest', async ({ request }) => {
    const res = await request.get(`${baseURL}/manifest.webmanifest`);
    expect(res.status()).toBe(200);

    const manifest = await res.json();
    expect(manifest.name).toBe('IntelliCivic - Smart City Platform');
    expect(manifest.short_name).toBe('IntelliCivic');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#2563eb');
    expect(manifest.background_color).toBe('#0f172a');
    expect(manifest.icons).toHaveLength(4);
    expect(manifest.icons[0].src).toBe('/icons/icon-192.png');
    expect(manifest.icons[2].src).toBe('/icons/icon-512.png');
  });

  test('2. GET /sw.js serves Service Worker file', async ({ request }) => {
    const res = await request.get(`${baseURL}/sw.js`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('intellicivic-v1');
    expect(text).toContain('caches.open');
    expect(text).toContain('addEventListener');
  });

  test('3. Root Page renders PWA Install Banner UI', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Wait for PWA install banner to appear
    const installBanner = page.locator('text=Install IntelliCivic App');
    await expect(installBanner).toBeVisible({ timeout: 5000 });

    // Capture screenshot of PWA Install Banner
    await page.screenshot({
      path: 'C:/Users/Bajrang Kumar 07/.gemini/antigravity-ide/brain/652d066f-b656-4386-bfff-612ab59b8cc2/pwa_install_banner.png',
      fullPage: false,
    });
  });
});
