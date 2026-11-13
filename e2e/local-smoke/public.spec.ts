import { test, expect } from '@playwright/test';
import path from 'path';

const VIEWPORTS = [
  { width: 375, height: 812, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1280, height: 800, name: 'desktop' },
];

const PUBLIC_PAGES = [
  { path: '/', label: 'home-redirect' },
  { path: '/public/transparency', label: 'public-transparency' },
  { path: '/login/citizen', label: 'login-citizen' },
  { path: '/login/staff', label: 'login-staff' },
];

test.describe('Public Smoke Matrix in Browser', () => {
  for (const pageInfo of PUBLIC_PAGES) {
    for (const vp of VIEWPORTS) {
      test(`Public page "${pageInfo.path}" at ${vp.width}x${vp.height}`, async ({ page }) => {
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

          // Wait a moment for dynamic rendering and client hydration
          await page.waitForTimeout(1000);

          if (server5xxErrors.length > 0 || consoleErrors.length > 0) {
            const screenPath = path.join(
              process.cwd(),
              'scratch',
              'screens',
              `public_${pageInfo.label}_${vp.width}x${vp.height}.png`,
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
            `public_${pageInfo.label}_${vp.width}x${vp.height}_FAIL.png`,
          );
          await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          throw err;
        }
      });
    }
  }
});

