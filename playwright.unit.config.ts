import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
});

