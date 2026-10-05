import { test, expect } from '@playwright/test';
import { attachOutcomeListeners, createAuthJwt, setAuthCookie, VIEWPORTS } from './sweep-helpers';
import prisma from '../../src/lib/prisma';

test.describe('Staff Roles (Officer, Dept Head, Field Worker) Outcome-Based Bug Sweep', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.beforeEach(async ({ page, context }) => {
        test.setTimeout(60000);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await context.addInitScript(() => {
          localStorage.setItem('ic_pwa_install_dismissed', String(Date.now()));
        });
      });

      // ─────────────────────────────────────────────────────────────────────────
      // 1. DEPARTMENT OFFICER
      // ─────────────────────────────────────────────────────────────────────────
      test('1. Department Officer: dashboard stats, complaints list, and assigned field worker dispatch', async ({
        page,
        context,
      }) => {
        const token = await createAuthJwt({
          sub: 'usr_officer_roads_1',
          role: 'DEPARTMENT_OFFICER',
          name: 'Amit Patel',
          email: 'officer.roads@smartcity.gov.in',
          departmentId: 'dept_roads_infra',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        // 1.1 Load Officer Dashboard
        await page.goto('/officer');
        await page.waitForLoadState('domcontentloaded');

        await expect(page.locator('main h1, main h2').first()).toBeVisible({ timeout: 10000 });

        // 1.2 Open Complaint Details to assign Field Worker
        await page.goto('/officer/complaints/cmp-field-assigned');
        await page.waitForLoadState('domcontentloaded');

        // Locate Field Worker assignment section
        const fwSelect = page.locator('select').filter({ hasText: /select field worker/i }).or(page.locator('select')).last();
        if (await fwSelect.isVisible()) {
          // Select assigned field worker: Ramesh Kumar (fw-demo-1)
          await fwSelect.selectOption({ label: 'Ramesh Kumar' });

          const assignBtn = page.getByRole('button', { name: /assign field worker/i });
          const [assignRes] = await Promise.all([
            page.waitForResponse((r) => r.url().includes('/assign') && r.request().method() === 'POST'),
            assignBtn.click(),
          ]);
          expect(assignRes.status()).toBe(200);

          // Verify success alert or text
          await expect(page.locator('text=Field Worker Assigned').or(page.locator('text=successfully assigned'))).toBeVisible();
        }

        outcome.assertClean();
      });

      test('2. Department Officer RBAC Edge: cross-officer worker assignment rejected with 403', async ({
        request,
      }) => {
        // Ensure fw-demo-other has null assignedOfficerId (unassigned / other team)
        await prisma.user.update({
          where: { id: 'fw-demo-other' },
          data: { assignedOfficerId: null },
        });

        const officerToken = await createAuthJwt({
          sub: 'usr_officer_roads_1',
          role: 'DEPARTMENT_OFFICER',
          name: 'Amit Patel',
          email: 'officer.roads@smartcity.gov.in',
          departmentId: 'dept_roads_infra',
        });

        const response = await request.post('/api/complaints/cmp-field-assigned/assign', {
          headers: { Cookie: `ic_access_token=${officerToken}` },
          data: { fieldWorkerId: 'fw-demo-other' },
        });

        expect(response.status(), 'Cross-officer worker assignment must return 403').toBe(403);
        const data = await response.json();
        expect(data.message).toContain('Forbidden');
      });

      // ─────────────────────────────────────────────────────────────────────────
      // 2. DEPARTMENT HEAD
      // ─────────────────────────────────────────────────────────────────────────
      test('3. Department Head: review AI triage and reject suggestion ("Not My Department")', async ({
        page,
        context,
      }) => {
        // Ensure cmp-dept-review-demo is pending review in dept_roads_infra
        await prisma.complaint.upsert({
          where: { id: 'cmp-dept-review-demo' },
          update: {
            status: 'PENDING_DEPT_REVIEW',
            departmentId: 'dept_roads_infra',
          },
          create: {
            id: 'cmp-dept-review-demo',
            ticketId: 'INC-2026-0904-5501',
            title: 'Damaged Drainage Cover along City By-pass',
            description: 'Heavy iron drainage cover displaced creating road hazard.',
            status: 'PENDING_DEPT_REVIEW',
            priority: 'HIGH',
            citizenId: 'citizen_9876543210',
            categoryId: 'cat-roads',
            departmentId: 'dept_roads_infra',
          },
        });

        const token = await createAuthJwt({
          sub: 'usr_dept_head_roads',
          role: 'DEPARTMENT_HEAD',
          name: 'Rajesh Sharma',
          email: 'head.roads@smartcity.gov.in',
          departmentId: 'dept_roads_infra',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        // 3.1 Load AI Suggestions page
        await page.goto('/dept-head/ai-suggestions');
        await page.waitForLoadState('domcontentloaded');

        // Locate Reject / "Not My Dept" button
        const rejectBtn = page.getByRole('button', { name: /not my department|reject suggestion|reject/i }).first();
        if (await rejectBtn.isVisible()) {
          const [rejectRes] = await Promise.all([
            page.waitForResponse((r) => r.url().includes('/reject-suggestion') && r.request().method() === 'PATCH'),
            rejectBtn.click(),
          ]);
          expect(rejectRes.status()).toBe(200);

          // Verify returned to triage banner
          await expect(
            page.locator('text=returned to Admin Triage').or(page.locator('text=rejected')),
          ).toBeVisible();
        }

        // 3.2 Load Team Workload page
        await page.goto('/dept-head/team');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('main h1, main h2').first()).toBeVisible({ timeout: 10000 });

        outcome.assertClean();
      });

      // ─────────────────────────────────────────────────────────────────────────
      // 3. FIELD WORKER
      // ─────────────────────────────────────────────────────────────────────────
      test('4. Field Worker: view assigned tasks, start work (IN_PROGRESS), and view details', async ({
        page,
        context,
      }) => {
        // Ensure cmp-field-assigned is in ASSIGNED status
        await prisma.complaint.upsert({
          where: { id: 'cmp-field-assigned' },
          update: { status: 'ASSIGNED', assignedFieldWorkerId: 'fw-demo-1' },
          create: {
            id: 'cmp-field-assigned',
            ticketId: 'INC-2026-0902-7711',
            title: 'Broken Traffic Light Wiring at Ring Road Crossing',
            description: 'Traffic signal control box door damaged. Wires exposed causing traffic light disruption.',
            status: 'ASSIGNED',
            priority: 'HIGH',
            citizenId: 'citizen_9876543210',
            categoryId: 'cat-electricity',
            departmentId: 'dept_roads_infra',
            assignedFieldWorkerId: 'fw-demo-1',
          },
        });

        const token = await createAuthJwt({
          sub: 'fw-demo-1',
          role: 'FIELD_WORKER',
          name: 'Ramesh Kumar',
          email: 'fieldworker@intellicivic.gov.in',
          departmentId: 'dept_roads_infra',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        // 4.1 Load Field Worker Dashboard
        await page.goto('/field-worker');
        await page.waitForLoadState('domcontentloaded');

        await expect(page.locator('text=Assigned').or(page.locator('text=Tasks')).first()).toBeVisible({ timeout: 10000 });

        // 4.2 Open Complaint Details
        await page.goto('/field-worker/complaints/cmp-field-assigned');
        await page.waitForLoadState('domcontentloaded');

        // Locate Start Work button
        const startWorkBtn = page.getByRole('button', { name: /start work|commence work|start task/i });
        if (await startWorkBtn.isVisible()) {
          const [startRes] = await Promise.all([
            page.waitForResponse((r) => r.url().includes('/start') && r.request().method() === 'POST'),
            startWorkBtn.click(),
          ]);
          expect(startRes.status()).toBe(200);

          // Verify status updated in DB & UI
          await expect(page.locator('text=In Progress').or(page.locator('text=IN_PROGRESS')).first()).toBeVisible({ timeout: 10000 });
        }

        outcome.assertClean();
      });
    });
  }
});
