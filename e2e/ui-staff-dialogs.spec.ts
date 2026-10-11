import { test, expect } from '@playwright/test';
import prisma from '@/lib/prisma';
import { ensureSuperAdminUser } from '@/lib/staff-dept-store';

const BASE = 'http://localhost:3000';

test.describe('UI Admin Staff Delete and Reassign Flows for exact screenshot staff', () => {
  test.setTimeout(90000);

  test('Verify Ramesh Kumar and Worker With Complaint flows at 1280px', async ({ page, request }) => {
    await ensureSuperAdminUser();

    // 1. Authenticate as SUPER_ADMIN
    const loginRes = await request.post(`${BASE}/api/auth/dev-login`, {
      data: { email: 'kumarbajrang325@gmail.com', role: 'ADMIN' },
    });
    expect(loginRes.ok()).toBe(true);

    const setCookies = loginRes.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value);
    let token = '';
    for (const c of setCookies) {
      const match = c.match(/ic_access_token=([^;]+)/);
      if (match) { token = match[1]; break; }
    }
    expect(token).toBeTruthy();

    await page.context().addCookies([{
      name: 'ic_access_token',
      value: token,
      domain: 'localhost',
      path: '/',
    }]);

    // 2. Fetch NDMC municipality and exact staff
    const ramesh = await prisma.user.findFirst({
      where: { name: 'Ramesh Kumar' },
    });
    expect(ramesh).not.toBeNull();

    let worker = await prisma.user.findFirst({
      where: { name: { contains: 'Worker With Complaint' } },
    });
    if (!worker) {
      // Re-create worker if deleted in earlier test
      worker = await prisma.user.create({
        data: {
          name: 'Worker With Complaint 1791652293955',
          email: 'worker_complaint_1791652293955@smartcity.gov.in',
          role: 'FIELD_WORKER',
          authProvider: 'GOOGLE',
          isAuthorized: true,
          municipalityId: ramesh!.municipalityId,
        },
      });
    }

    const ndmcMunId = ramesh!.municipalityId!;
    let ndmcDept = await prisma.department.findFirst({
      where: { municipalityId: ndmcMunId },
    });
    if (!ndmcDept) {
      ndmcDept = await prisma.department.findFirst();
    }

    let citizen = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
    if (!citizen) {
      citizen = await prisma.user.create({
        data: {
          name: 'Test Citizen UI',
          email: `test_citizen_ui_${Date.now()}@example.com`,
          role: 'CITIZEN',
          authProvider: 'GOOGLE',
          municipalityId: ndmcMunId,
        },
      });
    }

    // 3. Create open complaint assigned to Ramesh Kumar
    const testComplaint = await prisma.complaint.create({
      data: {
        ticketId: `TKT-UI-${Date.now()}`,
        citizenId: citizen.id,
        title: 'Water Pipeline Leakage on Main Road',
        description: 'Severe water leak requiring field inspection.',
        status: 'ASSIGNED',
        priority: 'HIGH',
        departmentId: ndmcDept!.id,
        municipalityId: ndmcMunId,
        assignedFieldWorkerId: ramesh!.id,
      },
    });

    // 4. Set Viewport to 1280px Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/admin/staff`);
    await page.waitForLoadState('networkidle');

    // ─────────────────────────────────────────────────────────────
    // FLOW A: Ramesh Kumar -> Delete Dialog -> Reassign Open Complaints
    // ─────────────────────────────────────────────────────────────
    const searchInput = page.getByPlaceholder('Search by name or email...');
    await searchInput.fill(ramesh!.email);
    await page.waitForTimeout(600);

    const rameshDelBtn = page.getByTestId(`delete-staff-${ramesh!.id}`);
    await expect(rameshDelBtn).toBeVisible({ timeout: 10000 });
    await rameshDelBtn.click();

    // Verify Step 1 Impact
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1. Impact')).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/flow-a-ramesh-step1-impact.png' });

    // Step 1 -> Step 2
    const nextBtn = page.getByRole('button', { name: /Next: Review Options & Alternatives/i });
    await expect(nextBtn).toBeEnabled({ timeout: 10000 });
    await nextBtn.click();

    // Step 2 Choose
    await expect(page.getByText('2. Choose')).toBeVisible();
    await expect(page.getByText(/1\. Reassign Open Complaints/i)).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/flow-a-ramesh-step2-options.png' });

    // Click "Reassign Only"
    const reassignOnlyBtn = page.getByRole('button', { name: 'Reassign Only' });
    await expect(reassignOnlyBtn).toBeVisible();
    await reassignOnlyBtn.click();

    // Reassign Modal Opens
    await expect(page.getByRole('heading', { name: 'Reassign Open Complaints' })).toBeVisible();
    await expect(page.getByText(/Transfer open complaints from/i)).toBeVisible();

    // Target dropdown should contain Worker With Complaint (same municipality NDMC)
    const selectTarget = page.locator('select').filter({ hasText: /Select Active Staff Member/i }).last();
    await expect(selectTarget).toBeVisible();
    await selectTarget.selectOption(worker!.id);
    await page.screenshot({ path: 'e2e/screens/flow-a-ramesh-reassign-modal.png' });

    // Click "Transfer Complaints"
    const transferBtn = page.getByRole('button', { name: 'Transfer Complaints' });
    await expect(transferBtn).toBeEnabled();
    await transferBtn.click();

    // Verify success notification
    await expect(page.getByText('Complaints Reassigned')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/screens/flow-a-ramesh-reassign-success.png' });

    // Dismiss the success popup
    const dismissBtn = page.getByRole('button', { name: 'Dismiss' });
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
      await page.waitForTimeout(300);
    }

    // Close any delete modal if still open
    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await page.waitForTimeout(300);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // ─────────────────────────────────────────────────────────────
    // FLOW B: Worker With Complaint -> 3-Step Permanent Delete Flow
    // ─────────────────────────────────────────────────────────────
    await searchInput.fill(worker!.email);
    await page.waitForTimeout(600);

    const workerDelBtn = page.getByTestId(`delete-staff-${worker!.id}`);
    await expect(workerDelBtn).toBeVisible({ timeout: 10000 });
    await workerDelBtn.click();

    // Step 1: Impact Assessment
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1. Impact')).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/flow-b-worker-step1-impact.png' });

    // Step 1 -> Step 2
    const nextBtnWorker = page.getByRole('button', { name: /Next: Review Options & Alternatives/i });
    await expect(nextBtnWorker).toBeEnabled({ timeout: 10000 });
    await nextBtnWorker.click();

    // Step 2: Choose
    await expect(page.getByText('2. Choose')).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/flow-b-worker-step2-options.png' });

    // Step 2 -> Step 3: Click "Delete permanently anyway"
    const deleteAnywayBtn = page.getByRole('button', { name: 'Delete permanently anyway' });
    await expect(deleteAnywayBtn).toBeVisible();
    await deleteAnywayBtn.click();

    // Step 3: Confirm
    await expect(page.getByText('3. Confirm')).toBeVisible();
    await expect(page.getByText(/Action for.*Open Complaint/i)).toBeVisible();

    // Select Unassign
    await page.getByText(/Unassign and return to triage pool/i).click();

    // Fill confirm email
    const emailInput = page.getByPlaceholder(worker!.email);
    await emailInput.fill(worker!.email);
    await page.screenshot({ path: 'e2e/screens/flow-b-worker-step3-confirm.png' });

    // Click "Delete permanently"
    const confirmDeleteBtn = page.getByRole('button', { name: 'Delete permanently' });
    await expect(confirmDeleteBtn).toBeEnabled();
    await confirmDeleteBtn.click();

    // Verify Staff Permanently Deleted popup appears
    await expect(page.getByText('Staff Permanently Deleted')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/has been permanently deleted from the database/i)).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/flow-b-worker-delete-success.png' });

    // Cleanup complaint
    await prisma.complaint.delete({ where: { id: testComplaint.id } }).catch(() => {});

    // Re-create Worker With Complaint so state is clean for future runs
    await prisma.user.create({
      data: {
        id: worker!.id,
        name: worker!.name,
        email: worker!.email,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: ndmcMunId,
      },
    }).catch(() => {});
  });

  test('Verify Ramesh Kumar and Worker With Complaint flows at 375px mobile', async ({ page, request }) => {
    await ensureSuperAdminUser();

    // 1. Authenticate as SUPER_ADMIN
    const loginRes = await request.post(`${BASE}/api/auth/dev-login`, {
      data: { email: 'kumarbajrang325@gmail.com', role: 'ADMIN' },
    });
    expect(loginRes.ok()).toBe(true);

    const setCookies = loginRes.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value);
    let token = '';
    for (const c of setCookies) {
      const match = c.match(/ic_access_token=([^;]+)/);
      if (match) { token = match[1]; break; }
    }
    expect(token).toBeTruthy();

    await page.context().addCookies([{
      name: 'ic_access_token',
      value: token,
      domain: 'localhost',
      path: '/',
    }]);

    // 2. Fetch NDMC municipality and exact staff
    const ramesh = await prisma.user.findFirst({
      where: { name: 'Ramesh Kumar' },
    });
    expect(ramesh).not.toBeNull();

    let worker = await prisma.user.findFirst({
      where: { name: { contains: 'Worker With Complaint' } },
    });
    if (!worker) {
      worker = await prisma.user.create({
        data: {
          name: 'Worker With Complaint 1791652293955',
          email: 'worker_complaint_1791652293955@smartcity.gov.in',
          role: 'FIELD_WORKER',
          authProvider: 'GOOGLE',
          isAuthorized: true,
          municipalityId: ramesh!.municipalityId,
        },
      });
    }

    const ndmcMunId = ramesh!.municipalityId!;
    let ndmcDept = await prisma.department.findFirst({
      where: { municipalityId: ndmcMunId },
    });
    if (!ndmcDept) {
      ndmcDept = await prisma.department.findFirst();
    }

    let citizen = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
    if (!citizen) {
      citizen = await prisma.user.create({
        data: {
          name: 'Test Citizen UI',
          email: `test_citizen_ui_m_${Date.now()}@example.com`,
          role: 'CITIZEN',
          authProvider: 'GOOGLE',
          municipalityId: ndmcMunId,
        },
      });
    }

    // 3. Create open complaint assigned to Ramesh Kumar
    const testComplaint = await prisma.complaint.create({
      data: {
        ticketId: `TKT-UIM-${Date.now()}`,
        citizenId: citizen.id,
        title: 'Water Leakage Mobile Inspection',
        description: 'Inspection needed on mobile screen.',
        status: 'ASSIGNED',
        priority: 'HIGH',
        departmentId: ndmcDept!.id,
        municipalityId: ndmcMunId,
        assignedFieldWorkerId: ramesh!.id,
      },
    });

    // 4. Set Viewport to 375px Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/admin/staff`);
    await page.waitForLoadState('networkidle');

    // ─────────────────────────────────────────────────────────────
    // FLOW A: Ramesh Kumar (375px)
    // ─────────────────────────────────────────────────────────────
    const searchInput = page.getByPlaceholder('Search by name or email...');
    await searchInput.fill(ramesh!.email);
    await page.waitForTimeout(600);

    const rameshDelBtn = page.getByTestId(`delete-staff-${ramesh!.id}`);
    await expect(rameshDelBtn).toBeVisible({ timeout: 10000 });
    await rameshDelBtn.scrollIntoViewIfNeeded();
    await rameshDelBtn.click();

    // Verify Step 1 Impact
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1. Impact')).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/mobile-375-flow-a-ramesh-step1-impact.png' });

    // Step 1 -> Step 2
    const nextBtn = page.getByRole('button', { name: /Next: Review Options & Alternatives/i });
    await expect(nextBtn).toBeEnabled({ timeout: 10000 });
    await nextBtn.click();

    // Step 2 Choose
    await expect(page.getByText('2. Choose')).toBeVisible();
    await expect(page.getByText(/1\. Reassign Open Complaints/i)).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/mobile-375-flow-a-ramesh-step2-options.png' });

    // Click "Reassign Only"
    const reassignOnlyBtn = page.getByRole('button', { name: 'Reassign Only' });
    await expect(reassignOnlyBtn).toBeVisible();
    await reassignOnlyBtn.click();

    // Reassign Modal Opens
    await expect(page.getByRole('heading', { name: 'Reassign Open Complaints' })).toBeVisible();
    await expect(page.getByText(/Transfer open complaints from/i)).toBeVisible();

    const selectTarget = page.locator('select').filter({ hasText: /Select Active Staff Member/i }).last();
    await expect(selectTarget).toBeVisible();
    await selectTarget.selectOption(worker!.id);
    await page.screenshot({ path: 'e2e/screens/mobile-375-flow-a-ramesh-reassign-modal.png' });

    // Click "Transfer Complaints"
    const transferBtn = page.getByRole('button', { name: 'Transfer Complaints' });
    await expect(transferBtn).toBeEnabled();
    await transferBtn.click();

    // Verify success notification
    await expect(page.getByText('Complaints Reassigned')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/screens/mobile-375-flow-a-ramesh-reassign-success.png' });

    // Dismiss the success popup
    const dismissBtn = page.getByRole('button', { name: 'Dismiss' });
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
      await page.waitForTimeout(300);
    }

    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await page.waitForTimeout(300);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // ─────────────────────────────────────────────────────────────
    // FLOW B: Worker With Complaint (375px)
    // ─────────────────────────────────────────────────────────────
    await searchInput.fill(worker!.email);
    await page.waitForTimeout(600);

    const workerDelBtn = page.getByTestId(`delete-staff-${worker!.id}`);
    await expect(workerDelBtn).toBeVisible({ timeout: 10000 });
    await workerDelBtn.scrollIntoViewIfNeeded();
    await workerDelBtn.click();

    // Step 1: Impact Assessment
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1. Impact')).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/mobile-375-flow-b-worker-step1-impact.png' });

    // Step 1 -> Step 2
    const nextBtnWorker = page.getByRole('button', { name: /Next: Review Options & Alternatives/i });
    await expect(nextBtnWorker).toBeEnabled({ timeout: 10000 });
    await nextBtnWorker.click();

    // Step 2: Choose
    await expect(page.getByText('2. Choose')).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/mobile-375-flow-b-worker-step2-options.png' });

    // Step 2 -> Step 3: Click "Delete permanently anyway"
    const deleteAnywayBtn = page.getByRole('button', { name: 'Delete permanently anyway' });
    await expect(deleteAnywayBtn).toBeVisible();
    await deleteAnywayBtn.click();

    // Step 3: Confirm
    await expect(page.getByText('3. Confirm')).toBeVisible();
    await page.getByText(/Unassign and return to triage pool/i).click();

    // Fill confirm email
    const emailInput = page.getByPlaceholder(worker!.email);
    await emailInput.fill(worker!.email);
    await page.screenshot({ path: 'e2e/screens/mobile-375-flow-b-worker-step3-confirm.png' });

    // Click "Delete permanently"
    const confirmDeleteBtn = page.getByRole('button', { name: 'Delete permanently' });
    await expect(confirmDeleteBtn).toBeEnabled();
    await confirmDeleteBtn.click();

    // Verify Staff Permanently Deleted popup appears
    await expect(page.getByText('Staff Permanently Deleted')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/has been permanently deleted from the database/i)).toBeVisible();
    await page.screenshot({ path: 'e2e/screens/mobile-375-flow-b-worker-delete-success.png' });

    // Cleanup complaint
    await prisma.complaint.delete({ where: { id: testComplaint.id } }).catch(() => {});

    // Re-create Worker With Complaint so state is clean for future runs
    await prisma.user.create({
      data: {
        id: worker!.id,
        name: worker!.name,
        email: worker!.email,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: ndmcMunId,
      },
    }).catch(() => {});
  });
});
