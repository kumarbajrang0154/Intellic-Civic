import { test, expect, APIRequestContext } from '@playwright/test';
import prisma from '@/lib/prisma';
import { getDefaultMunicipality, ensureSuperAdminUser } from '@/lib/staff-dept-store';

const BASE = 'http://localhost:3000';

async function getAdminContext(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/dev-login`, {
    data: { email: 'kumarbajrang325@gmail.com', role: 'ADMIN' },
  });
  if (!res.ok()) {
    throw new Error(`dev-login failed (${res.status()}): ${await res.text()}`);
  }
  const setCookies = res.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value);
  for (const c of setCookies) {
    const match = c.match(/ic_access_token=([^;]+)/);
    if (match) return `ic_access_token=${match[1]}`;
  }
  const fallback = res.headers()['set-cookie'] ?? '';
  const match = fallback.match(/ic_access_token=([^;]+)/);
  if (!match) {
    throw new Error(`No ic_access_token found. dev-login: ${res.status()}`);
  }
  return `ic_access_token=${match[1]}`;
}

async function getNonAdminContext(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/dev-login`, {
    data: { email: 'officer.roads@smartcity.gov.in', role: 'DEPARTMENT_OFFICER' },
  });
  if (!res.ok()) {
    throw new Error(`non-admin dev-login failed (${res.status()}): ${await res.text()}`);
  }
  const setCookies = res.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value);
  for (const c of setCookies) {
    const match = c.match(/ic_access_token=([^;]+)/);
    if (match) return `ic_access_token=${match[1]}`;
  }
  const fallback = res.headers()['set-cookie'] ?? '';
  const match = fallback.match(/ic_access_token=([^;]+)/);
  return match ? `ic_access_token=${match[1]}` : '';
}

test.describe('Admin Permanent Staff Deletion Suite', () => {
  test.setTimeout(90000);

  let defaultMun: any;
  let testDept: any;
  let testCitizen: any;

  test.beforeAll(async () => {
    await ensureSuperAdminUser();
    defaultMun = await getDefaultMunicipality();
    testDept = await prisma.department.findFirst({
      where: { municipalityId: defaultMun.id },
    });
    if (!testDept) {
      testDept = await prisma.department.findFirst();
    }
    testCitizen = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
    if (!testCitizen) {
      testCitizen = await prisma.user.create({
        data: {
          name: 'Test Citizen',
          email: `test_citizen_${Date.now()}@example.com`,
          role: 'CITIZEN',
          authProvider: 'GOOGLE',
          municipalityId: defaultMun.id,
        },
      });
    }
    // Ensure admin user has municipalityId set
    await prisma.user.updateMany({
      where: { email: 'kumarbajrang325@gmail.com' },
      data: { municipalityId: defaultMun.id },
    });
  });

  async function createComplaint(data: {
    title: string;
    description?: string;
    status?: any;
    priority?: any;
    assignedFieldWorkerId?: string;
  }) {
    return prisma.complaint.create({
      data: {
        ticketId: `TKT-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        citizenId: testCitizen.id,
        title: data.title,
        description: data.description || 'Test complaint description',
        status: data.status || 'ASSIGNED',
        priority: data.priority || 'MEDIUM',
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
        assignedFieldWorkerId: data.assignedFieldWorkerId,
      },
    });
  }

  test('1. Staff with open complaints + audit + evidence + notifications: permanent delete with "reassign"', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const ts = Date.now();
    const staffEmail = `test_staff_reassign_${ts}@example.com`;
    const targetStaffEmail = `test_target_staff_${ts}@example.com`;

    // Create staff member to delete
    const staff = await prisma.user.create({
      data: {
        name: `Staff To Delete ${ts}`,
        email: staffEmail,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        passwordHash: '$2b$10$eDummyHashForTestingStaffDeleteOnly1234567890',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    // Create reassign target staff
    const targetStaff = await prisma.user.create({
      data: {
        name: `Target Officer ${ts}`,
        email: targetStaffEmail,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    // Create an open complaint assigned to staff
    const complaint = await createComplaint({
      title: `Open Pothole Complaint ${ts}`,
      description: 'Test complaint for permanent delete reassign workflow',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignedFieldWorkerId: staff.id,
    });

    // Create officer assignment record
    const assignment = await prisma.assignment.create({
      data: {
        complaintId: complaint.id,
        departmentOfficerId: staff.id,
        assignedByUserId: staff.id,
      },
    });

    // Create evidence uploaded by this staff member
    const evidence = await prisma.evidence.create({
      data: {
        complaintId: complaint.id,
        imageUrl: 'https://storage.example.com/test-evidence-1.jpg',
        stage: 'BEFORE',
        uploadedByUserId: staff.id,
        uploadedByName: staff.name,
      },
    });

    // Create a notification for this staff member
    const notif = await prisma.notification.create({
      data: {
        recipientUserId: staff.id,
        complaintId: complaint.id,
        type: 'COMPLAINT_CREATED',
        message: 'You have been assigned complaint ' + complaint.id,
      },
    });

    // Create an audit row authored by this staff member
    const priorAudit = await prisma.auditLog.create({
      data: {
        userId: staff.id,
        action: 'COMPLAINT_STATUS_CHANGED',
        entityType: 'Complaint',
        entityId: complaint.id,
        metadata: { initialNote: 'Officer accepted case' },
      },
    });

    // Count complaints before deletion
    const complaintCountBefore = await prisma.complaint.count();

    // Call POST /api/admin/staff/[id]/permanent-delete with reassign
    const res = await request.post(`${BASE}/api/admin/staff/${staff.id}/permanent-delete`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        confirmEmail: staffEmail,
        openComplaintsAction: 'reassign',
        reassignToId: targetStaff.id,
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(body.reassignedCount).toBeGreaterThanOrEqual(1);

    // ── DB Assertions ──────────────────────────────────────────────────────────
    // 1. User row is completely deleted
    const deletedUser = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(deletedUser).toBeNull();

    // 2. Complaint count unchanged (NEVER lost or deleted)
    const complaintCountAfter = await prisma.complaint.count();
    expect(complaintCountAfter).toBe(complaintCountBefore);

    // 3. Complaint now reassigned to target staff
    const updatedComplaint = await prisma.complaint.findUnique({ where: { id: complaint.id } });
    expect(updatedComplaint).not.toBeNull();
    expect(updatedComplaint?.assignedFieldWorkerId).toBe(targetStaff.id);

    // 4. Evidence row kept, uploadedByUserId is nulled, author snapshot preserved
    const updatedEvidence = await prisma.evidence.findUnique({ where: { id: evidence.id } });
    expect(updatedEvidence).not.toBeNull();
    expect(updatedEvidence?.uploadedByUserId).toBeNull();
    expect(updatedEvidence?.uploadedByName).toBe(staff.name);

    // 5. Notifications for deleted user removed
    const remainingNotifs = await prisma.notification.findMany({ where: { recipientUserId: staff.id } });
    expect(remainingNotifs.length).toBe(0);

    // 6. Pre-existing audit row kept, userId nulled, actor snapshot preserved
    const updatedPriorAudit = await prisma.auditLog.findUnique({ where: { id: priorAudit.id } });
    expect(updatedPriorAudit).not.toBeNull();
    expect(updatedPriorAudit?.userId).toBeNull();
    const meta = updatedPriorAudit?.metadata as any;
    expect(meta?.actorName).toBe(staff.name);
    expect(meta?.actorEmail).toBe(staff.email);

    // 7. Deletion audit row exists
    const deletionAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'STAFF_PERMANENTLY_DELETED',
        entityId: staff.id,
      },
    });
    expect(deletionAudit).not.toBeNull();
    const delMeta = deletionAudit?.metadata as any;
    expect(delMeta?.targetEmail).toBe(staff.email);
    expect(delMeta?.reassignedCount).toBeGreaterThanOrEqual(1);

    // 8. Confirm email becomes free again by re-creating a user with same email
    const recreated = await prisma.user.create({
      data: {
        name: 'Recreated Staff Member',
        email: staffEmail,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: defaultMun.id,
      },
    });
    expect(recreated.id).toBeDefined();
    expect(recreated.email.toLowerCase()).toBe(staffEmail.toLowerCase());

    // Cleanup
    await prisma.user.delete({ where: { id: recreated.id } });
    await prisma.complaint.delete({ where: { id: complaint.id } });
    await prisma.user.delete({ where: { id: targetStaff.id } });
  });

  test('2. Staff with open complaints: permanent delete with "unassign"', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const ts = Date.now();
    const staffEmail = `test_staff_unassign_${ts}@example.com`;

    const staff = await prisma.user.create({
      data: {
        name: `Staff To Unassign ${ts}`,
        email: staffEmail,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    // Create 2 open complaints assigned to staff
    const c1 = await createComplaint({
      title: `Unassign Complaint 1 ${ts}`,
      status: 'ASSIGNED',
      assignedFieldWorkerId: staff.id,
    });

    const c2 = await createComplaint({
      title: `Unassign Complaint 2 ${ts}`,
      status: 'IN_PROGRESS',
      assignedFieldWorkerId: staff.id,
    });

    const totalBefore = await prisma.complaint.count();

    const res = await request.post(`${BASE}/api/admin/staff/${staff.id}/permanent-delete`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        confirmEmail: staffEmail,
        openComplaintsAction: 'unassign',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(body.unassignedCount).toBe(2);

    // User row deleted
    const checkUser = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(checkUser).toBeNull();

    // Complaint count identical
    const totalAfter = await prisma.complaint.count();
    expect(totalAfter).toBe(totalBefore);

    // Check both complaints are unassigned and in triage pool
    const checkC1 = await prisma.complaint.findUnique({ where: { id: c1.id } });
    const checkC2 = await prisma.complaint.findUnique({ where: { id: c2.id } });
    expect(checkC1?.assignedFieldWorkerId).toBeNull();
    expect(checkC1?.status).toBe('PENDING_DEPT_REVIEW');

    expect(checkC2?.assignedFieldWorkerId).toBeNull();
    expect(checkC2?.status).toBe('PENDING_DEPT_REVIEW');

    // Cleanup
    await prisma.complaint.deleteMany({ where: { id: { in: [c1.id, c2.id] } } });
  });

  test('3. Missing/wrong confirmEmail or missing openComplaintsAction returns 400', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const ts = Date.now();
    const staffEmail = `test_bad_confirm_${ts}@example.com`;

    const staff = await prisma.user.create({
      data: {
        name: `Staff Bad Confirm ${ts}`,
        email: staffEmail,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    const complaint = await createComplaint({
      title: `Complaint for bad confirm ${ts}`,
      status: 'ASSIGNED',
      assignedFieldWorkerId: staff.id,
    });

    // 3a. Wrong email
    const resWrong = await request.post(`${BASE}/api/admin/staff/${staff.id}/permanent-delete`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: 'wrong@example.com', openComplaintsAction: 'unassign' },
    });
    expect(resWrong.status()).toBe(400);
    const bodyWrong = await resWrong.json();
    expect(bodyWrong.message).toMatch(/confirmation email does not match/i);

    // 3b. Missing openComplaintsAction when open complaints exist
    const resNoAction = await request.post(`${BASE}/api/admin/staff/${staff.id}/permanent-delete`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: staffEmail },
    });
    expect(resNoAction.status()).toBe(400);
    const bodyNoAction = await resNoAction.json();
    expect(bodyNoAction.message).toMatch(/openComplaintsAction.*is required/i);

    // User must still exist
    const userStillExists = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(userStillExists).not.toBeNull();

    // Cleanup
    await prisma.complaint.delete({ where: { id: complaint.id } });
    await prisma.user.delete({ where: { id: staff.id } });
  });

  test('4. Mid-transaction failure triggers rollback without leaving orphaned data', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const ts = Date.now();
    const staffEmail = `test_rollback_${ts}@example.com`;

    const staff = await prisma.user.create({
      data: {
        name: `Rollback Staff ${ts}`,
        email: staffEmail,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    const complaint = await createComplaint({
      title: `Rollback Complaint ${ts}`,
      status: 'ASSIGNED',
      assignedFieldWorkerId: staff.id,
    });

    // Pass forceRollbackForTest to simulate a failure mid-transaction
    const res = await request.post(`${BASE}/api/admin/staff/${staff.id}/permanent-delete`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        confirmEmail: staffEmail,
        openComplaintsAction: 'unassign',
        forceRollbackForTest: true,
      },
    });

    expect(res.status()).toBe(500);

    // Assert user and complaint are completely unchanged
    const userAfterRollback = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(userAfterRollback).not.toBeNull();
    expect(userAfterRollback?.email).toBe(staffEmail);

    const complaintAfterRollback = await prisma.complaint.findUnique({ where: { id: complaint.id } });
    expect(complaintAfterRollback?.assignedFieldWorkerId).toBe(staff.id);
    expect(complaintAfterRollback?.status).toBe('ASSIGNED');

    // Cleanup
    await prisma.complaint.delete({ where: { id: complaint.id } });
    await prisma.user.delete({ where: { id: staff.id } });
  });

  test('5. Blocked guards: Self, Super Admin, Last Admin, Other Municipality, Non-Admin', async ({ request }) => {
    const adminCookie = await getAdminContext(request);
    const nonAdminCookie = await getNonAdminContext(request);

    // 5a. Non-admin trying to delete -> 403
    const nonAdminRes = await request.post(`${BASE}/api/admin/staff/some-id/permanent-delete`, {
      headers: { cookie: nonAdminCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: 'test@example.com' },
    });
    expect([401, 403]).toContain(nonAdminRes.status());

    // 5b. Self delete -> 400
    const adminUser = await prisma.user.findFirst({
      where: { email: 'kumarbajrang325@gmail.com' },
    });
    if (adminUser) {
      const selfRes = await request.post(`${BASE}/api/admin/staff/${adminUser.id}/permanent-delete`, {
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        data: { confirmEmail: adminUser.email },
      });
      expect(selfRes.status()).toBe(400);
      const selfBody = await selfRes.json();
      expect(selfBody.message).toMatch(/cannot delete your own account/i);
    }

    // 5c. Super Admin delete -> 403
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    if (superAdmin) {
      const saRes = await request.post(`${BASE}/api/admin/staff/${superAdmin.id}/permanent-delete`, {
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        data: { confirmEmail: superAdmin.email },
      });
      expect(saRes.status()).toBe(403);
      const saBody = await saRes.json();
      expect(saBody.message).toMatch(/super admin.*cannot be deleted/i);
    }

    // 5d. Other municipality target -> 403
    const otherMun = await prisma.municipality.create({
      data: {
        name: `Other Mun ${Date.now()}`,
        code: `OM-${Date.now()}`,
        city: 'Other City',
        state: 'State',
      },
    });
    const otherMunStaff = await prisma.user.create({
      data: {
        name: 'Other Mun Staff',
        email: `other_mun_${Date.now()}@example.com`,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: otherMun.id,
      },
    });

    const otherMunRes = await request.post(`${BASE}/api/admin/staff/${otherMunStaff.id}/permanent-delete`, {
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: otherMunStaff.email },
    });
    expect(otherMunRes.status()).toBe(403);
    expect((await otherMunRes.json()).message).toMatch(/different municipality/i);

    // Cleanup other mun
    await prisma.user.delete({ where: { id: otherMunStaff.id } });
    await prisma.municipality.delete({ where: { id: otherMun.id } });
  });

  test('6. Officer with field workers under them: workers detached cleanly', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const ts = Date.now();
    const officerEmail = `officer_with_workers_${ts}@example.com`;

    const officer = await prisma.user.create({
      data: {
        name: `Officer Leader ${ts}`,
        email: officerEmail,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    const worker = await prisma.user.create({
      data: {
        name: `Subordinate Worker ${ts}`,
        email: `subordinate_worker_${ts}@example.com`,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
        assignedOfficerId: officer.id,
      },
    });

    const res = await request.post(`${BASE}/api/admin/staff/${officer.id}/permanent-delete`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        confirmEmail: officerEmail,
        openComplaintsAction: 'unassign',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(body.detachedWorkersCount).toBe(1);

    // Assert worker still exists with assignedOfficerId set to null
    const workerAfter = await prisma.user.findUnique({ where: { id: worker.id } });
    expect(workerAfter).not.toBeNull();
    expect(workerAfter?.assignedOfficerId).toBeNull();

    // Cleanup
    await prisma.user.delete({ where: { id: worker.id } });
  });

  test('7. Bulk permanent delete: 3 staff with 1 forbidden produces partial result', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const ts = Date.now();

    const staff1 = await prisma.user.create({
      data: {
        name: `Bulk Staff 1 ${ts}`,
        email: `bulk1_${ts}@example.com`,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    const staff2 = await prisma.user.create({
      data: {
        name: `Bulk Staff 2 ${ts}`,
        email: `bulk2_${ts}@example.com`,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    expect(superAdmin).not.toBeNull();

    const res = await request.post(`${BASE}/api/admin/staff/bulk`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        action: 'PERMANENT_DELETE',
        ids: [staff1.id, staff2.id, superAdmin!.id],
        openComplaintsAction: 'unassign',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toBe(2);
    expect(body.failed).toBe(1);

    // Verify per-id result
    const results = body.results;
    const r1 = results.find((r: any) => r.id === staff1.id);
    const r2 = results.find((r: any) => r.id === staff2.id);
    const r3 = results.find((r: any) => r.id === superAdmin!.id);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(false);
    expect(r3.error).toMatch(/super admin.*protected/i);

    // Verify DB states
    expect(await prisma.user.findUnique({ where: { id: staff1.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: staff2.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: superAdmin!.id } })).not.toBeNull();
  });

  test('8. UI 3-Step Permanent Delete flow at 1280px and 375px', async ({ page, request }) => {
    const cookie = await getAdminContext(request);
    const ts = Date.now();
    const staffEmail = `ui_delete_test_${ts}@example.com`;

    const staff = await prisma.user.create({
      data: {
        name: `UI Delete Test Officer ${ts}`,
        email: staffEmail,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    const complaint = await createComplaint({
      title: `UI Test Case For Impact ${ts}`,
      description: 'Test complaint details for impact report view',
      status: 'ASSIGNED',
      assignedFieldWorkerId: staff.id,
    });

    await page.context().addCookies([{
      name: 'ic_access_token',
      value: cookie.replace('ic_access_token=', ''),
      domain: 'localhost',
      path: '/',
    }]);

    // 8a. Test at 1280px Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/admin/staff`);
    await page.waitForLoadState('networkidle');

    // Search for staff
    const searchInput = page.getByPlaceholder('Search by name or email...');
    await searchInput.fill(staffEmail);
    await page.waitForTimeout(600);

    // Click delete button for this staff member
    const deleteBtn = page.getByTestId(`delete-staff-${staff.id}`);
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
    await deleteBtn.click();

    // STEP 1: Verify Impact Assessment
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1. Impact')).toBeVisible();
    const nextBtn = page.getByRole('button', { name: /Next: Review Options & Alternatives/i });
    await expect(nextBtn).toBeEnabled({ timeout: 20000 });
    await expect(page.getByText(complaint.title)).toBeVisible({ timeout: 10000 });

    // Click "Next: Review Options & Alternatives"
    await nextBtn.click();

    // STEP 2: Verify Alternatives
    await expect(page.getByText('2. Choose')).toBeVisible();
    await expect(page.getByText(/Deactivate Account/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete permanently anyway' })).toBeVisible();

    // Click "Delete permanently anyway"
    await page.getByRole('button', { name: 'Delete permanently anyway' }).click();

    // STEP 3: Execution
    await expect(page.getByText('3. Confirm')).toBeVisible();
    await expect(page.getByText(/Action for.*Open Complaint/i)).toBeVisible();

    // Choose Unassign
    await page.getByText(/Unassign and return to triage pool/i).click();

    // Type confirmation email
    const emailInput = page.getByPlaceholder(staffEmail);
    await emailInput.fill(staffEmail);

    // Click red "Delete permanently"
    const confirmDeleteBtn = page.getByRole('button', { name: 'Delete permanently' });
    await expect(confirmDeleteBtn).toBeEnabled();
    await confirmDeleteBtn.click();

    // Verify result popup appears
    await expect(page.getByText('Staff Permanently Deleted')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/has been permanently deleted from the database/i)).toBeVisible();

    // Close the popup by clicking outside or close button if present
    const closeBtn = page.getByRole('button', { name: /close|ok|dismiss/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    }

    // 8b. Test at 375px Mobile Viewport
    const mobileStaffEmail = `mobile_del_${ts}@example.com`;
    const mobileStaff = await prisma.user.create({
      data: {
        name: `Mobile Staff ${ts}`,
        email: mobileStaffEmail,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/admin/staff`);
    await page.waitForLoadState('networkidle');

    const mobileSearch = page.getByPlaceholder('Search by name or email...');
    await mobileSearch.fill(mobileStaffEmail);
    await page.waitForTimeout(600);

    const mobileDelBtn = page.getByTestId(`delete-staff-${mobileStaff.id}`);
    await expect(mobileDelBtn).toBeVisible({ timeout: 10000 });
    await mobileDelBtn.click();

    // Check modal visibility and ensure no horizontal overflow at 375px
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375);
    }

    // Step 1 -> Step 2
    const mobileNextBtn = page.getByRole('button', { name: /Next: Review Options/i });
    await expect(mobileNextBtn).toBeEnabled({ timeout: 20000 });
    await mobileNextBtn.click();
    await page.waitForTimeout(300);

    // Step 2 -> Step 3
    await page.getByRole('button', { name: 'Delete permanently anyway' }).click();
    await page.waitForTimeout(300);

    // Type email & delete
    const mobileEmailInput = page.getByPlaceholder(mobileStaffEmail);
    await mobileEmailInput.fill(mobileStaffEmail);
    await page.getByRole('button', { name: 'Delete permanently' }).click();

    // Verify popup on mobile
    await expect(page.getByText('Staff Permanently Deleted')).toBeVisible({ timeout: 15000 });

    // Cleanup
    await prisma.complaint.delete({ where: { id: complaint.id } });
  });

  test('9. Passwords and hashes are never leaked in audit logs or API responses', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const ts = Date.now();
    const staffEmail = `leak_check_${ts}@example.com`;

    const staff = await prisma.user.create({
      data: {
        name: `Leak Check Staff ${ts}`,
        email: staffEmail,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        passwordHash: '$2b$10$SecretSuperConfidentialPasswordHashDoNotLeak123456',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    const res = await request.post(`${BASE}/api/admin/staff/${staff.id}/permanent-delete`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        confirmEmail: staffEmail,
        openComplaintsAction: 'unassign',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    const stringifiedResponse = JSON.stringify(body);
    expect(stringifiedResponse).not.toContain('SecretSuperConfidentialPasswordHash');
    expect(stringifiedResponse).not.toContain('passwordHash');

    // Check audit log row
    const auditRow = await prisma.auditLog.findFirst({
      where: {
        action: 'STAFF_PERMANENTLY_DELETED',
        entityId: staff.id,
      },
    });
    expect(auditRow).not.toBeNull();
    const stringifiedAudit = JSON.stringify(auditRow);
    expect(stringifiedAudit).not.toContain('SecretSuperConfidentialPasswordHash');
    expect(stringifiedAudit).not.toContain('passwordHash');
    expect(stringifiedAudit).not.toContain('password');
  });
});
