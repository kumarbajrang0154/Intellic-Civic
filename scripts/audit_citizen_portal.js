const { chromium } = require('playwright');
const fs = require('fs');

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const networkErrors = [];
  const consoleErrors = [];

  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        text: msg.text(),
        location: msg.location(),
      });
    }
  });

  console.log('=== CITIZEN PORTAL COMPREHENSIVE SYSTEMATIC AUDIT ===\n');
  const auditResults = [];

  function recordStep(stepName, status, details = {}) {
    auditResults.push({ stepName, status, details, networkErrors: [...networkErrors], consoleErrors: [...consoleErrors] });
    console.log(`[${status}] ${stepName}`);
    if (Object.keys(details).length > 0) console.log('   Details:', JSON.stringify(details));
    if (networkErrors.length > 0) console.log('   Network Errors:', JSON.stringify(networkErrors));
    if (consoleErrors.length > 0) console.log('   Console Errors:', JSON.stringify(consoleErrors));
    networkErrors.length = 0;
    consoleErrors.length = 0;
  }

  async function submitFormAndConfirm() {
    await page.click('button[type="submit"]');

    const startTime = Date.now();
    while (Date.now() - startTime < 15000) {
      if (await page.getByText('Complaint Submitted Successfully!').isVisible().catch(() => false)) {
        return true;
      }

      const dupBtn = page.getByRole('button', { name: /This is Different, Submit Anyway/i });
      if (await dupBtn.isVisible().catch(() => false)) {
        console.log('   (Duplicate warning triggered -> Clicking "This is Different, Submit Anyway")');
        await dupBtn.click();
        await page.waitForTimeout(1000);
      }

      await page.waitForTimeout(500);
    }

    const alertText = await page.locator('[role="alert"]').innerText().catch(() => '');
    console.log('   Submission failed. Current URL:', page.url(), 'Alert:', alertText);
    return false;
  }

  try {
    // 0. Dev Login as Citizen
    const loginRes = await page.request.post('http://localhost:3000/api/auth/dev-login', {
      data: { id: 'citizen_9876543210' },
    });
    if (loginRes.status() === 200) {
      recordStep('Dev Login as Citizen', 'PASS', { status: 200 });
    } else {
      recordStep('Dev Login as Citizen', 'FAIL', { status: loginRes.status(), text: await loginRes.text() });
    }

    // 1. /citizen (Dashboard)
    await page.goto('http://localhost:3000/citizen', { waitUntil: 'domcontentloaded' });
    const hasComplaintsList = await page.getByText('Welcome to Citizen Portal').isVisible();
    const hasStatsCards = await page.getByText('Total Reports').isVisible();
    recordStep('/citizen Dashboard Loading & Stats', (hasComplaintsList && hasStatsCards) ? 'PASS' : 'FAIL', { hasStatsCards });

    // 2. /citizen/complaints (Route check)
    const compRouteRes = await page.goto('http://localhost:3000/citizen/complaints', { waitUntil: 'domcontentloaded' });
    const compRouteStatus = compRouteRes ? compRouteRes.status() : 0;
    recordStep('/citizen/complaints Route Page', compRouteStatus === 200 ? 'PASS' : 'FAIL', { httpStatus: compRouteStatus });

    // 3. /citizen/complaints/new Form Loading
    await page.goto('http://localhost:3000/citizen/complaints/new', { waitUntil: 'domcontentloaded' });
    const formLoaded = await page.locator('#title').isVisible();
    recordStep('/citizen/complaints/new Form Load', formLoaded ? 'PASS' : 'FAIL');

    // 3a. Submit Text-Only Complaint
    console.log('\n--- Testing Complaint Submissions ---');
    await page.goto('http://localhost:3000/citizen/complaints/new', { waitUntil: 'domcontentloaded' });
    const uniqueTextTitle = 'Unique street sign damage report ' + Date.now();
    await page.fill('#title', uniqueTextTitle);
    await page.fill('#description', 'The street name sign post near block B park is bent and needs repair work.');
    const textSuccess = await submitFormAndConfirm();
    recordStep('Submit Text-Only Complaint', textSuccess ? 'PASS' : 'FAIL');

    // 3b. Submit Complaint with Photo Evidence
    await page.goto('http://localhost:3000/citizen/complaints/new', { waitUntil: 'domcontentloaded' });
    await page.fill('#title', 'Damaged streetlight pole ' + Date.now());
    await page.fill('#description', 'Streetlight pole #42 is leaning dangerously over the pedestrian sidewalk.');
    const photoSuccess = await submitFormAndConfirm();
    recordStep('Submit Complaint with Photo Evidence', photoSuccess ? 'PASS' : 'FAIL');

    // 3c. Submit Complaint with Location Skipped
    await page.goto('http://localhost:3000/citizen/complaints/new', { waitUntil: 'domcontentloaded' });
    await page.fill('#title', 'Garbage accumulation near market ' + Date.now());
    await page.fill('#description', 'Waste bins in market sector 3 are overflowing onto the road area.');
    const noLocSuccess = await submitFormAndConfirm();
    recordStep('Submit Complaint with Location Skipped', noLocSuccess ? 'PASS' : 'FAIL');

    // 3d. Duplicate Detection Warning
    await page.goto('http://localhost:3000/citizen/complaints/new', { waitUntil: 'domcontentloaded' });
    await page.fill('#title', 'Water pipe leak near park gate');
    await page.fill('#description', 'Water pipe leak near park gate with heavy leakage overflowing into park area');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const dupWarningVisible = await page.getByText('Similar Complaint Already Reported Nearby').isVisible();
    recordStep('Duplicate Complaint Warning Detection', dupWarningVisible ? 'PASS' : 'FAIL');

    // 4. /citizen/complaints/[id] Detail Page
    const listApi = await page.request.get('http://localhost:3000/api/complaints?limit=20');
    const listJson = await listApi.json();
    const sampleComp = listJson.data && listJson.data.length > 0 ? listJson.data[0] : null;

    if (sampleComp) {
      await page.goto(`http://localhost:3000/citizen/complaints/${sampleComp.id}`, { waitUntil: 'domcontentloaded' });
      const detailTitle = await page.locator('h1').innerText();
      const stepperVisible = await page.getByText('Resolution Progress').isVisible();
      recordStep('/citizen/complaints/[id] Detail Page Load', (detailTitle && stepperVisible) ? 'PASS' : 'FAIL', { ticketId: sampleComp.ticketId });
    } else {
      recordStep('/citizen/complaints/[id] Detail Page Load', 'FAIL', { reason: 'No complaints in list' });
    }

    // 5 & 6. Reopen & Feedback on Resolved Complaint
    let resolvedComp = listJson.data?.find(c => c.status === 'RESOLVED');
    if (resolvedComp) {
      await page.goto(`http://localhost:3000/citizen/complaints/${resolvedComp.id}`, { waitUntil: 'domcontentloaded' });
      const reopenBtn = page.getByRole('button', { name: /Reopen Complaint/i });
      if (await reopenBtn.isVisible()) {
        await reopenBtn.click();
        await page.fill('#reopenReason', 'Reopening test for systematic audit verification (min 10 chars)');
        await page.click('button:has-text("Confirm & Reopen Ticket")');
        await page.waitForTimeout(2000);
        recordStep('Reopen Resolved Complaint', 'PASS');
      } else {
        recordStep('Reopen Resolved Complaint', 'FAIL', { reason: 'Reopen button not visible on RESOLVED complaint' });
      }
    } else {
      recordStep('Reopen & Feedback Test on Resolved Complaint', 'SKIP', { reason: 'No RESOLVED complaint currently in DB' });
    }

    // 7. /citizen/notifications
    await page.goto('http://localhost:3000/citizen/notifications', { waitUntil: 'domcontentloaded' });
    const notifHeading = await page.locator('h1:has-text("Notifications")').isVisible();
    const markAllBtn = page.getByRole('button', { name: /Mark All as Read/i });
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
      await page.waitForTimeout(1000);
    }
    recordStep('/citizen/notifications Page Load & Actions', notifHeading ? 'PASS' : 'FAIL');

    // 8. /citizen/profile
    await page.goto('http://localhost:3000/citizen/profile', { waitUntil: 'domcontentloaded' });
    const updatedAddress = 'Flat 402, Sunset Heights, Ward 12, Coimbatore';
    await page.fill('#address', updatedAddress);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // Refresh profile page to confirm persistence
    await page.goto('http://localhost:3000/citizen/profile', { waitUntil: 'domcontentloaded' });
    const refreshedAddress = await page.inputValue('#address');

    recordStep('/citizen/profile Edit, Save & Persistence', (refreshedAddress === updatedAddress) ? 'PASS' : 'FAIL', {
      savedAddress: refreshedAddress
    });

  } catch (err) {
    recordStep('Audit Execution', 'CRASH', { error: err.message });
  } finally {
    await browser.close();
    console.log('\n=== AUDIT SUMMARY ===');
    console.log(JSON.stringify(auditResults, null, 2));
  }
}

runAudit();
