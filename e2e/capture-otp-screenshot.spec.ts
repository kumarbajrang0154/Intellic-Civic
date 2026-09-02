import { test } from '@playwright/test';

test('Capture Citizen OTP Login Form Screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:3000/login/citizen');
  await page.waitForLoadState('networkidle');

  // Fill mobile number
  await page.fill('#mobileNumber', '9876543210');
  await page.screenshot({
    path: 'C:/Users/Bajrang Kumar 07/.gemini/antigravity-ide/brain/652d066f-b656-4386-bfff-612ab59b8cc2/citizen_otp_login_form.png',
    fullPage: false,
  });
});
