const { chromium } = require('playwright');
const { SignJWT } = require('jose');

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  const token = await new SignJWT({
    sub: '0cecd3fc-e75f-440f-b790-0ea7ecd9c196',
    role: 'CITIZEN',
    name: 'Demo Citizen',
    mobileNumber: '9876543210',
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!'));

  await context.addCookies([{ name: 'ic_access_token', value: token, domain: 'localhost', path: '/' }]);

  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:3000/citizen/complaints/new');
  await page.waitForLoadState('networkidle');

  await page.fill('input[id="title"]', 'Broken Water Pipe Flooding Road');
  await page.fill('textarea[id="description"]', 'Water main ruptured near main street corner causing severe flooding and road block.');

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: 'broken-pipe.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'),
  });

  await page.waitForSelector('img[alt^="Evidence"]');
  console.log('EVIDENCE IMG VISIBLE!');

  await context.setOffline(true);
  console.log('SET OFFLINE. Clicking submit...');

  await page.click('button[type="submit"]:has-text("Submit Complaint")');
  await page.waitForTimeout(3000);

  const isVisible = await page.getByRole('heading', { name: 'Saved Offline' }).isVisible();
  console.log('IS HEADING VISIBLE:', isVisible);

  await browser.close();
}

main().catch(console.error);
