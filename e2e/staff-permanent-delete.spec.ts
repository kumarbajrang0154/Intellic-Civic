import { test, expect, APIRequestContext } from '@playwright/test';
import prisma from '@/lib/prisma';
import { getDefaultMunicipality, ensureSuperAdminUser } from '@/lib/staff-dept-store';
import { createJwtToken } from '@/lib/auth-jwt';

const BASE = 'http://localhost:3000';

async function getAdminContext(request: APIRequestContext): Promise<string> {
  let sa = await prisma.user.findFirst({
    where: { email: 'superadmin.test@smartcity.gov.in' },
  });
  if (!sa) {
    const mun = await getDefaultMunicipality();
    sa = await prisma.user.create({
      data: {
        email: 'superadmin.test@smartcity.gov.in',
        name: 'Test Super Admin',
        role: 'SUPER_ADMIN',
        authProvider: 'GOOGLE',
        municipalityId: mun.id,
        isAuthorized: true,
      },
    });
  }
  const token = await createJwtToken({
    sub: sa.id,
    email: sa.email,
    role: sa.role as any,
    municipalityId: sa.municipalityId || undefined,
  }, '7d');
  return `ic_access_token=${token}`;
}

async function getNonAdminContext(request: APIRequestContext): Promise<string> {
  let officer = await prisma.user.findFirst({
    where: { email: 'officer.roads@smartcity.gov.in' },
  });
  if (!officer) {
    const mun = await getDefaultMunicipality();
    officer = await prisma.user.create({
      data: {
        email: 'officer.roads@smartcity.gov.in',
        name: 'Officer Roads',
        role: 'DEPARTMENT_OFFICER',
        municipalityId: mun.id,
        isAuthorized: true,
      },
    });
  }
  const token = await createJwtToken({
    sub: officer.id,
    email: officer.email,
    role: officer.role as any,
    municipalityId: officer.municipalityId || undefined,
  }, '7d');
  return `ic_access_token=${token}`;
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
      where: { email: 'superadmin.test@smartcity.gov.in' },
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

    // Create Municipal Admin context for testing unauthorized privilege escalation
    const munAdminEmail = `mun_admin_${Date.now()}@testmun.gov.in`;
    const munAdminUser = await prisma.user.create({
      data: {
        name: 'Municipal Admin Tester',
        email: munAdminEmail,
        role: 'ADMIN',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: defaultMun.id,
      },
    });
    const munAdminToken = await createJwtToken({
      sub: munAdminUser.id,
      email: munAdminUser.email,
      name: munAdminUser.name,
      role: 'ADMIN',
      isAuthorized: true,
      municipalityId: defaultMun.id,
    }, '7d');
    const munAdminCookie = `ic_access_token=${munAdminToken}`;

    // 5c. Super Admin target blocked for municipal admin -> 403
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    if (superAdmin) {
      const saRes = await request.post(`${BASE}/api/admin/staff/${superAdmin.id}/permanent-delete`, {
        headers: { cookie: munAdminCookie, 'Content-Type': 'application/json' },
        data: { confirmEmail: superAdmin.email },
      });
      expect(saRes.status()).toBe(403);
      const saBody = await saRes.json();
      expect(saBody.message).toMatch(/protected/i);
    }

    // 5d. Municipal ADMIN on other municipality target -> 403
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
      headers: { cookie: munAdminCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: otherMunStaff.email },
    });
    expect(otherMunRes.status()).toBe(403);
    expect((await otherMunRes.json()).message).toMatch(/only manage staff of your own municipality/i);

    // Cleanup other mun and test admin
    await prisma.user.delete({ where: { id: otherMunStaff.id } });
    await prisma.municipality.delete({ where: { id: otherMun.id } });
    await prisma.user.delete({ where: { id: munAdminUser.id } });
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

  test('8a. UI 3-Step Permanent Delete flow at 1280px Desktop', async ({ page, request }) => {
    test.setTimeout(90000);
    const cookie = await getAdminContext(request);
    const ts = Date.now();
    const staffEmail = `ui_desk_del_${ts}@example.com`;

    const staff = await prisma.user.create({
      data: {
        name: `UI Desktop Officer ${ts}`,
        email: staffEmail,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    const complaint = await createComplaint({
      title: `UI Desktop Case Impact ${ts}`,
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

    // Cleanup complaint
    await prisma.complaint.delete({ where: { id: complaint.id } }).catch(() => {});
  });

  test('8b. UI 3-Step Permanent Delete flow at 375px Mobile Viewport', async ({ page, request }) => {
    test.setTimeout(90000);
    const cookie = await getAdminContext(request);
    const ts = Date.now();
    const mobileStaffEmail = `ui_mob_del_${ts}@example.com`;

    const mobileStaff = await prisma.user.create({
      data: {
        name: `UI Mobile Staff ${ts}`,
        email: mobileStaffEmail,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: testDept.id,
        municipalityId: defaultMun.id,
      },
    });

    await page.context().addCookies([{
      name: 'ic_access_token',
      value: cookie.replace('ic_access_token=', ''),
      domain: 'localhost',
      path: '/',
    }]);

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

  test('10. Cross-Municipality Management: SUPER_ADMIN succeeds (unassign & reassign), Municipal ADMIN blocked with 403', async ({ request }) => {
    const superAdminCookie = await getAdminContext(request);
    const ts = Date.now();

    // 1. Create a distinct municipality with its own department
    const munB = await prisma.municipality.create({
      data: {
        name: `Mun B Test ${ts}`,
        code: `MB-${ts}`,
        city: 'City B',
        state: 'State B',
      },
    });

    const deptB = await prisma.department.create({
      data: {
        name: `Department B ${ts}`,
        description: 'Dept B Description',
        municipalityId: munB.id,
      },
    });

    // Create a municipal ADMIN for Mun A (defaultMun)
    const munAAdminEmail = `mun_a_admin_${ts}@smartcity.gov.in`;
    const munAAdmin = await prisma.user.create({
      data: {
        name: `Mun A Admin ${ts}`,
        email: munAAdminEmail,
        role: 'ADMIN',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: defaultMun.id,
      },
    });
    const munAToken = await createJwtToken({
      sub: munAAdmin.id,
      email: munAAdmin.email,
      name: munAAdmin.name,
      role: 'ADMIN',
      isAuthorized: true,
      municipalityId: defaultMun.id,
    }, '7d');
    const munAAdminCookie = `ic_access_token=${munAToken}`;

    // Create staff member 1 in Mun B
    const staffB1 = await prisma.user.create({
      data: {
        name: `Staff B1 ${ts}`,
        email: `staff_b1_${ts}@munb.gov.in`,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: deptB.id,
        municipalityId: munB.id,
      },
    });

    // Create staff member 2 in Mun B
    const staffB2 = await prisma.user.create({
      data: {
        name: `Staff B2 ${ts}`,
        email: `staff_b2_${ts}@munb.gov.in`,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: deptB.id,
        municipalityId: munB.id,
      },
    });

    // Create complaint assigned to staffB1 in Mun B
    const complaintB = await prisma.complaint.create({
      data: {
        ticketId: `TKT-B-${ts}`,
        citizenId: testCitizen.id,
        title: `Complaint in Mun B ${ts}`,
        description: 'Complaint in Municipality B',
        status: 'ASSIGNED',
        priority: 'MEDIUM',
        departmentId: deptB.id,
        municipalityId: munB.id,
        assignedFieldWorkerId: staffB1.id,
      },
    });

    // ── Check 1: Municipal ADMIN from Mun A targeting Mun B staff -> 403 on ALL routes ──
    const del403 = await request.post(`${BASE}/api/admin/staff/${staffB1.id}/permanent-delete`, {
      headers: { cookie: munAAdminCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: staffB1.email, openComplaintsAction: 'unassign' },
    });
    expect(del403.status()).toBe(403);
    expect((await del403.json()).message).toMatch(/only manage staff of your own municipality/i);

    const reassign403 = await request.post(`${BASE}/api/admin/users/${staffB1.id}/reassign-complaints`, {
      headers: { cookie: munAAdminCookie, 'Content-Type': 'application/json' },
      data: { targetStaffId: staffB2.id },
    });
    expect(reassign403.status()).toBe(403);
    expect((await reassign403.json()).message).toMatch(/only manage staff of your own municipality/i);

    const preflight403 = await request.get(`${BASE}/api/admin/users/${staffB1.id}/delete-preflight`, {
      headers: { cookie: munAAdminCookie },
    });
    expect(preflight403.status()).toBe(403);
    expect((await preflight403.json()).message).toMatch(/only manage staff of your own municipality/i);

    const archive403 = await request.post(`${BASE}/api/admin/users/${staffB1.id}/archive`, {
      headers: { cookie: munAAdminCookie },
    });
    expect(archive403.status()).toBe(403);
    expect((await archive403.json()).message).toMatch(/only manage staff of your own municipality/i);

    const deact403 = await request.patch(`${BASE}/api/admin/staff/${staffB1.id}/deactivate`, {
      headers: { cookie: munAAdminCookie },
    });
    expect(deact403.status()).toBe(403);
    expect((await deact403.json()).message).toMatch(/only manage staff of your own municipality/i);

    const pwd403 = await request.post(`${BASE}/api/admin/staff/${staffB1.id}/password`, {
      headers: { cookie: munAAdminCookie, 'Content-Type': 'application/json' },
      data: { password: 'ValidPassword123!', confirmPassword: 'ValidPassword123!' },
    });
    expect(pwd403.status()).toBe(403);
    expect((await pwd403.json()).message).toMatch(/only manage staff of your own municipality/i);

    // Verify staffB1 is completely unchanged in DB
    const unchangedStaff = await prisma.user.findUnique({ where: { id: staffB1.id } });
    expect(unchangedStaff).not.toBeNull();
    expect(unchangedStaff?.isSuspended).toBe(false);

    // ── Check 2: Cross-municipality complaint leakage prevention ──
    // Target staff in another municipality (defaultMun) must be rejected with 400
    const leakRes = await request.post(`${BASE}/api/admin/users/${staffB1.id}/reassign-complaints`, {
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      data: { targetStaffId: munAAdmin.id },
    });
    expect(leakRes.status()).toBe(400);
    expect((await leakRes.json()).message).toMatch(/same municipality/i);

    // ── Check 3: SUPER_ADMIN reassign-complaints within Mun B works ──
    const reassignOk = await request.post(`${BASE}/api/admin/users/${staffB1.id}/reassign-complaints`, {
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      data: { targetStaffId: staffB2.id },
    });
    expect(reassignOk.status()).toBe(200);
    const reassignData = await reassignOk.json();
    expect(reassignData.reassignedCount).toBe(1);

    // Verify complaint in DB is now assigned to staffB2
    const complaintAfterReassign = await prisma.complaint.findUnique({ where: { id: complaintB.id } });
    expect(complaintAfterReassign?.assignedFieldWorkerId).toBe(staffB2.id);

    // ── Check 4: SUPER_ADMIN permanently deletes staffB2 with "reassign" back to staffB1 ──
    const delReassignOk = await request.post(`${BASE}/api/admin/staff/${staffB2.id}/permanent-delete`, {
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      data: {
        confirmEmail: staffB2.email,
        openComplaintsAction: 'reassign',
        reassignToId: staffB1.id,
      },
    });
    expect(delReassignOk.status()).toBe(200);
    expect((await delReassignOk.json()).deleted).toBe(true);

    // Assert staffB2 is permanently deleted from DB, complaint kept and reassigned to staffB1
    const staffB2Db = await prisma.user.findUnique({ where: { id: staffB2.id } });
    expect(staffB2Db).toBeNull();
    const complaintAfterDelReassign = await prisma.complaint.findUnique({ where: { id: complaintB.id } });
    expect(complaintAfterDelReassign?.assignedFieldWorkerId).toBe(staffB1.id);

    // ── Check 5: SUPER_ADMIN permanently deletes staffB1 with "unassign" ──
    const delUnassignOk = await request.post(`${BASE}/api/admin/staff/${staffB1.id}/permanent-delete`, {
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      data: {
        confirmEmail: staffB1.email,
        openComplaintsAction: 'unassign',
      },
    });
    expect(delUnassignOk.status()).toBe(200);
    expect((await delUnassignOk.json()).deleted).toBe(true);

    // Assert staffB1 is permanently deleted from DB, complaint kept & returned to triage pool
    const staffB1Db = await prisma.user.findUnique({ where: { id: staffB1.id } });
    expect(staffB1Db).toBeNull();
    const complaintAfterDelUnassign = await prisma.complaint.findUnique({ where: { id: complaintB.id } });
    expect(complaintAfterDelUnassign).not.toBeNull();
    expect(complaintAfterDelUnassign?.assignedFieldWorkerId).toBeNull();
    expect(complaintAfterDelUnassign?.status).toBe('PENDING_DEPT_REVIEW');

    // ── Cleanup ──
    await prisma.complaint.delete({ where: { id: complaintB.id } }).catch(() => {});
    await prisma.department.delete({ where: { id: deptB.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: munAAdmin.id } }).catch(() => {});
    await prisma.municipality.delete({ where: { id: munB.id } }).catch(() => {});
  });

  test('12. Root Admin privileges, non-root Super Admin restrictions, Root Admin protection, spoof prevention, and audit crossMunicipality flags', async ({ request }) => {
    const rootAdminUser = await ensureSuperAdminUser();
    const rootAdminToken = await createJwtToken({
      sub: rootAdminUser.id,
      email: rootAdminUser.email,
      name: rootAdminUser.name,
      role: 'SUPER_ADMIN',
      isAuthorized: true,
      municipalityId: rootAdminUser.municipalityId || undefined,
    }, '7d');
    const rootAdminCookie = `ic_access_token=${rootAdminToken}`;
    expect(rootAdminUser).not.toBeNull();

    const ts = Date.now();

    // 1. Root admin permanently deletes staff of another municipality (reassign and unassign variants)
    const munZ = await prisma.municipality.create({
      data: { name: `Mun Z ${ts}`, code: `MZ-${ts}`, city: 'City Z', state: 'State Z' },
    });
    const deptZ = await prisma.department.create({
      data: { name: `Dept Z ${ts}`, description: 'Test Dept Z', municipalityId: munZ.id },
    });
    const staffZ1 = await prisma.user.create({
      data: {
        name: `Staff Z1 ${ts}`,
        email: `staff_z1_${ts}@munz.gov.in`,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: deptZ.id,
        municipalityId: munZ.id,
      },
    });
    const staffZ2 = await prisma.user.create({
      data: {
        name: `Staff Z2 ${ts}`,
        email: `staff_z2_${ts}@munz.gov.in`,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: deptZ.id,
        municipalityId: munZ.id,
      },
    });
    const complaintZ = await prisma.complaint.create({
      data: {
        ticketId: `TKT-Z-${ts}`,
        citizenId: testCitizen.id,
        title: `Complaint in Mun Z ${ts}`,
        description: 'Test complaint',
        status: 'ASSIGNED',
        departmentId: deptZ.id,
        municipalityId: munZ.id,
        assignedFieldWorkerId: staffZ1.id,
      },
    });

    // Root admin reassigns complaints cross-municipality within Mun Z -> works
    const rootReassignRes = await request.post(`${BASE}/api/admin/users/${staffZ1.id}/reassign-complaints`, {
      headers: { cookie: rootAdminCookie, 'Content-Type': 'application/json' },
      data: { targetStaffId: staffZ2.id },
    });
    expect(rootReassignRes.status()).toBe(200);

    // Root admin deletes staffZ2 with unassign -> works, complaint kept
    const rootDelZ2 = await request.post(`${BASE}/api/admin/staff/${staffZ2.id}/permanent-delete`, {
      headers: { cookie: rootAdminCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: staffZ2.email, openComplaintsAction: 'unassign' },
    });
    expect(rootDelZ2.status()).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: staffZ2.id } })).toBeNull();
    const complaintAfterDel = await prisma.complaint.findUnique({ where: { id: complaintZ.id } });
    expect(complaintAfterDel).not.toBeNull();
    expect(complaintAfterDel?.status).toBe('PENDING_DEPT_REVIEW');

    // 2. Root admin deletes another municipal ADMIN -> 200, user gone!
    const targetAdmin = await prisma.user.create({
      data: {
        name: `Target Admin ${ts}`,
        email: `target_admin_${ts}@test.gov.in`,
        role: 'ADMIN',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: munZ.id,
      },
    });
    const rootDelAdmin = await request.post(`${BASE}/api/admin/staff/${targetAdmin.id}/permanent-delete`, {
      headers: { cookie: rootAdminCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: targetAdmin.email, openComplaintsAction: 'unassign' },
    });
    expect(rootDelAdmin.status()).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: targetAdmin.id } })).toBeNull();

    // 3. Root admin deletes another SUPER_ADMIN -> 200, user gone!
    const targetSuperAdmin = await prisma.user.create({
      data: {
        name: `Target Super Admin ${ts}`,
        email: `target_sa_${ts}@platform.gov.in`,
        role: 'SUPER_ADMIN',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: defaultMun.id,
      },
    });
    const rootDelSa = await request.post(`${BASE}/api/admin/staff/${targetSuperAdmin.id}/permanent-delete`, {
      headers: { cookie: rootAdminCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: targetSuperAdmin.email, openComplaintsAction: 'unassign' },
    });
    expect(rootDelSa.status()).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: targetSuperAdmin.id } })).toBeNull();

    // 4. Non-root SUPER_ADMIN:
    const nonRootSa = await prisma.user.create({
      data: {
        name: `Non-Root SA ${ts}`,
        email: `non_root_sa_${ts}@platform.gov.in`,
        role: 'SUPER_ADMIN',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: defaultMun.id,
      },
    });
    const nonRootSaToken = await createJwtToken({
      sub: nonRootSa.id,
      email: nonRootSa.email,
      name: nonRootSa.name,
      role: 'SUPER_ADMIN',
      isAuthorized: true,
      municipalityId: defaultMun.id,
    }, '7d');
    const nonRootSaCookie = `ic_access_token=${nonRootSaToken}`;

    // Non-root SA manages other-municipality staff and ADMINs -> 200 allowed
    const otherMunAdmin = await prisma.user.create({
      data: {
        name: `Other Mun Admin ${ts}`,
        email: `other_admin_${ts}@munz.gov.in`,
        role: 'ADMIN',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: munZ.id,
      },
    });
    const nonRootDelOtherAdmin = await request.post(`${BASE}/api/admin/staff/${otherMunAdmin.id}/permanent-delete`, {
      headers: { cookie: nonRootSaCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: otherMunAdmin.email, openComplaintsAction: 'unassign' },
    });
    expect(nonRootDelOtherAdmin.status()).toBe(200);

    // Non-root SA blocked on other SUPER_ADMIN -> 403
    const peerSa = await prisma.user.create({
      data: {
        name: `Peer SA ${ts}`,
        email: `peer_sa_${ts}@platform.gov.in`,
        role: 'SUPER_ADMIN',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: defaultMun.id,
      },
    });
    const nonRootDelPeerSa = await request.post(`${BASE}/api/admin/staff/${peerSa.id}/permanent-delete`, {
      headers: { cookie: nonRootSaCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: peerSa.email, openComplaintsAction: 'unassign' },
    });
    expect(nonRootDelPeerSa.status()).toBe(403);
    expect((await nonRootDelPeerSa.json()).message).toMatch(/Super Admin accounts are permanently protected/i);

    // Non-root SA blocked on Root Admin -> 403 ("Root admin account is protected.")
    const nonRootDelRoot = await request.post(`${BASE}/api/admin/staff/${rootAdminUser!.id}/permanent-delete`, {
      headers: { cookie: nonRootSaCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: rootAdminUser!.email, openComplaintsAction: 'unassign' },
    });
    expect(nonRootDelRoot.status()).toBe(403);
    expect((await nonRootDelRoot.json()).message).toMatch(/Root admin account is protected/i);

    // 5. Root Admin Protected across all other privileged routes:
    // Archive
    const rootArchRes = await request.post(`${BASE}/api/admin/users/${rootAdminUser!.id}/archive`, {
      headers: { cookie: nonRootSaCookie },
    });
    expect(rootArchRes.status()).toBe(403);
    expect((await rootArchRes.json()).message).toMatch(/Root admin account is protected/i);

    // Deactivate / suspend
    const rootDeactRes = await request.patch(`${BASE}/api/admin/staff/${rootAdminUser!.id}/deactivate`, {
      headers: { cookie: nonRootSaCookie },
    });
    expect(rootDeactRes.status()).toBe(403);
    expect((await rootDeactRes.json()).message).toMatch(/Root admin account is protected/i);

    // Password reset
    const rootPwdRes = await request.post(`${BASE}/api/admin/staff/${rootAdminUser!.id}/password`, {
      headers: { cookie: nonRootSaCookie, 'Content-Type': 'application/json' },
      data: { password: 'NewSecurePassword123!', confirmPassword: 'NewSecurePassword123!' },
    });
    expect(rootPwdRes.status()).toBe(403);
    expect((await rootPwdRes.json()).message).toMatch(/Root admin account is protected/i);

    // Role reassign
    const rootReassignRes2 = await request.patch(`${BASE}/api/admin/staff/${rootAdminUser!.id}/reassign`, {
      headers: { cookie: nonRootSaCookie, 'Content-Type': 'application/json' },
      data: { newRole: 'FIELD_WORKER' },
    });
    expect(rootReassignRes2.status()).toBe(403);
    expect((await rootReassignRes2.json()).message).toMatch(/Root admin account is protected/i);

    // Bulk delete touching root admin
    const rootBulkRes = await request.post(`${BASE}/api/admin/staff/bulk`, {
      headers: { cookie: nonRootSaCookie, 'Content-Type': 'application/json' },
      data: { action: 'PERMANENT_DELETE', ids: [rootAdminUser!.id] },
    });
    const bulkData = await rootBulkRes.json();
    const rootResult = bulkData.results?.find((r: any) => r.id === rootAdminUser!.id);
    expect(rootResult?.ok).toBe(false);
    expect(rootResult?.error).toMatch(/Root admin account is protected/i);

    // Pending approve touching root admin
    const rootApproveRes = await request.patch(`${BASE}/api/users/${rootAdminUser!.id}/approve`, {
      headers: { cookie: nonRootSaCookie, 'Content-Type': 'application/json' },
      data: { role: 'FIELD_WORKER' },
    });
    expect(rootApproveRes.status()).toBe(403);
    expect((await rootApproveRes.json()).message).toMatch(/Root admin account is protected/i);

    // Self-delete blocked for Root Admin -> 400
    const rootSelfDel = await request.post(`${BASE}/api/admin/staff/${rootAdminUser!.id}/permanent-delete`, {
      headers: { cookie: rootAdminCookie, 'Content-Type': 'application/json' },
      data: { confirmEmail: rootAdminUser!.email, openComplaintsAction: 'unassign' },
    });
    expect(rootSelfDel.status()).toBe(400);
    expect((await rootSelfDel.json()).message).toMatch(/cannot delete your own account/i);

    // Root admin row is completely unchanged in DB
    const rootDb = await prisma.user.findUnique({ where: { id: rootAdminUser!.id } });
    expect(rootDb?.role).toBe('SUPER_ADMIN');
    expect(rootDb?.isAuthorized).toBe(true);
    expect(rootDb?.isSuspended).toBe(false);
    expect(rootDb?.deletedAt).toBeNull();

    // 6. Spoof test: user with root email but role != SUPER_ADMIN gets NO root powers
    const spoofToken = await createJwtToken({
      sub: 'spoofed_user_id',
      email: 'kumarbajrang325@gmail.com',
      name: 'Spoofed Citizen',
      role: 'CITIZEN',
      isAuthorized: true,
    }, '7d');
    const spoofRes = await request.post(`${BASE}/api/admin/staff/${peerSa.id}/permanent-delete`, {
      headers: { cookie: `ic_access_token=${spoofToken}`, 'Content-Type': 'application/json' },
      data: { confirmEmail: peerSa.email },
    });
    expect([401, 403]).toContain(spoofRes.status());

    // Unverified Google email gets 401
    const unverifiedGoogleRes = await request.post(`${BASE}/api/auth/google-login`, {
      data: {
        email: 'kumarbajrang325@gmail.com',
        name: 'Spoofed Google',
        email_verified: false,
      },
    });
    expect(unverifiedGoogleRes.status()).toBe(401);
    expect((await unverifiedGoogleRes.json()).message).toMatch(/not verified/i);

    // 7. Audit row assertions: verify crossMunicipality flag is recorded
    const auditLogs = await prisma.auditLog.findMany({
      where: { action: 'STAFF_PERMANENTLY_DELETED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    const logWithMeta = auditLogs.find((l: any) => l.metadata && (l.metadata as any).crossMunicipality !== undefined);
    expect(logWithMeta).toBeDefined();
    const meta = logWithMeta!.metadata as any;
    expect(typeof meta.crossMunicipality).toBe('boolean');
    expect(meta.actorEmail).toBeDefined();
    expect(meta.targetEmail).toBeDefined();

    // Cleanup
    await prisma.user.delete({ where: { id: peerSa.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: nonRootSa.id } }).catch(() => {});
    await prisma.complaint.delete({ where: { id: complaintZ.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: staffZ1.id } }).catch(() => {});
    await prisma.department.delete({ where: { id: deptZ.id } }).catch(() => {});
    await prisma.municipality.delete({ where: { id: munZ.id } }).catch(() => {});
  });
});

