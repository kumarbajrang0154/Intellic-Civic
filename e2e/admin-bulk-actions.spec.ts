import { test, expect } from '@playwright/test';
import prisma from '@/lib/prisma';
import { AuthProvider, EvidenceStage, UserRole } from '@prisma/client';

const BASE = 'http://localhost:3000';

function makeJwt(user: { id: string; email?: string | null; role?: string | null; isAuthorized?: boolean; municipalityId?: string | null }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      isAuthorized: user.isAuthorized ?? true,
      municipalityId: user.municipalityId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

async function getAdminSession() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, isSuspended: false, isAuthorized: true },
  });
  if (!admin) throw new Error('No admin user found in database');
  const token = makeJwt(admin);
  return { admin, token, cookie: `ic_access_token=${token}` };
}

async function getOfficerSession() {
  const officer = await prisma.user.findFirst({
    where: { role: UserRole.DEPARTMENT_OFFICER, isSuspended: false },
  });
  if (!officer) throw new Error('No officer user found in database');
  const token = makeJwt(officer);
  return { officer, token, cookie: `ic_access_token=${token}` };
}

test.describe('Admin Bulk Actions Verification', () => {
  // ── 1. Batch Limit > 25 IDs -> 400 ──────────────────────────────────────────
  test('rejection when >25 IDs are passed in batch (HTTP 400)', async ({ request }) => {
    const { cookie } = await getAdminSession();
    const fakeIds = Array.from({ length: 26 }, (_, i) => `fake-id-${i + 1}`);

    const res = await request.post(`${BASE}/api/admin/staff/bulk`, {
      headers: { cookie },
      data: { action: 'DEACTIVATE', ids: fakeIds },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('maximum 25 IDs');

    // Also verify citizens bulk batch limit
    const cRes = await request.post(`${BASE}/api/admin/citizens/bulk`, {
      headers: { cookie },
      data: { action: 'SUSPEND', ids: fakeIds },
    });
    expect(cRes.status()).toBe(400);

    // Also verify pending users bulk batch limit
    const pRes = await request.post(`${BASE}/api/admin/users/pending/bulk`, {
      headers: { cookie },
      data: { action: 'APPROVE', ids: fakeIds },
    });
    expect(pRes.status()).toBe(400);
  });

  // ── 2. RBAC: Non-admin and wrong-role get 403 ─────────────────────────────────
  test('non-admin or wrong-role receives 403 Forbidden', async ({ request }) => {
    // Unauthenticated
    const noAuthRes = await request.post(`${BASE}/api/admin/staff/bulk`, {
      data: { action: 'DEACTIVATE', ids: ['id-1'] },
    });
    expect(noAuthRes.status()).toBe(401);

    // Officer (wrong role)
    const { cookie: officerCookie } = await getOfficerSession();
    const officerRes = await request.post(`${BASE}/api/admin/staff/bulk`, {
      headers: { cookie: officerCookie },
      data: { action: 'DEACTIVATE', ids: ['id-1'] },
    });
    expect(officerRes.status()).toBe(403);
    const body = await officerRes.json();
    expect(body.message).toContain('Admin access required');
  });

  // ── 3. Bulk Suspend 3 -> DB state + audit rows ──────────────────────────────
  test('bulk suspend 3 staff -> DB state isSuspended=true and audit rows written', async ({ request }) => {
    const { cookie, admin } = await getAdminSession();

    // Create 3 active staff members in the same municipality
    const timestamp = Date.now();
    const createdUsers: any[] = [];
    for (let i = 1; i <= 3; i++) {
      const u = await prisma.user.create({
        data: {
          name: `Bulk Suspend Test Staff ${i} ${timestamp}`,
          email: `bulk_susp_${i}_${timestamp}@smartcity.gov.in`,
          role: UserRole.DEPARTMENT_OFFICER,
          authProvider: AuthProvider.GOOGLE,
          isAuthorized: true,
          isSuspended: false,
          municipalityId: admin.municipalityId,
        },
      });
      createdUsers.push(u);
    }

    const targetIds = createdUsers.map((u) => u.id);

    try {
      const res = await request.post(`${BASE}/api/admin/staff/bulk`, {
        headers: { cookie },
        data: { action: 'DEACTIVATE', ids: targetIds },
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.succeeded).toBe(3);
      expect(data.failed).toBe(0);

      // Verify DB state for all 3
      const updatedInDb = await prisma.user.findMany({
        where: { id: { in: targetIds } },
      });
      expect(updatedInDb.length).toBe(3);
      for (const u of updatedInDb) {
        expect(u.isSuspended).toBe(true);
      }

      // Verify Audit Log rows exist
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityId: { in: targetIds },
          action: 'STAFF_DEACTIVATED',
        },
      });
      expect(auditLogs.length).toBe(3);
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: targetIds } } });
      await prisma.user.deleteMany({ where: { id: { in: targetIds } } });
    }
  });

  // ── 4. Mixed IDs (SUPER_ADMIN, self, other-municipality) -> partial results ──
  test('mixed IDs incl. SUPER_ADMIN, self, other-municipality -> partial result with honest errors', async ({ request }) => {
    // 0. Create a distinct ADMIN actor in default municipality
    const mun = await prisma.municipality.findFirst();
    const timestamp = Date.now();
    const actor = await prisma.user.create({
      data: {
        name: `Actor Admin ${timestamp}`,
        email: `actor_admin_${timestamp}@smartcity.gov.in`,
        role: UserRole.ADMIN,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: true,
        municipalityId: mun?.id,
      },
    });
    const cookie = `ic_access_token=${makeJwt(actor)}`;

    // 1. Valid user in actor's municipality
    const validUser = await prisma.user.create({
      data: {
        name: `Valid Staff ${timestamp}`,
        email: `valid_staff_${timestamp}@smartcity.gov.in`,
        role: UserRole.DEPARTMENT_OFFICER,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: true,
        isSuspended: false,
        municipalityId: actor.municipalityId,
      },
    });

    // 2. A distinct SUPER_ADMIN
    const superAdmin = await prisma.user.create({
      data: {
        name: `Super Admin Shield ${timestamp}`,
        email: `super_shield_${timestamp}@smartcity.gov.in`,
        role: UserRole.SUPER_ADMIN,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: true,
        municipalityId: actor.municipalityId,
      },
    });

    // 3. User in a different municipality
    const otherMun = await prisma.municipality.upsert({
      where: { code: 'TEST_OTHER_MUN' },
      update: {},
      create: {
        name: 'Other Municipality Test',
        code: 'TEST_OTHER_MUN',
        city: 'Madurai',
        state: 'Tamil Nadu',
      },
    });

    const otherMunUser = await prisma.user.create({
      data: {
        name: `Other Mun Staff ${timestamp}`,
        email: `other_mun_${timestamp}@smartcity.gov.in`,
        role: UserRole.DEPARTMENT_OFFICER,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: true,
        municipalityId: otherMun.id,
      },
    });

    const mixedIds = [validUser.id, actor.id, superAdmin.id, otherMunUser.id];

    try {
      const res = await request.post(`${BASE}/api/admin/staff/bulk`, {
        headers: { cookie },
        data: { action: 'DEACTIVATE', ids: mixedIds },
      });
      expect(res.status()).toBe(200);
      const data = await res.json();

      expect(data.ok).toBe(true);
      expect(data.succeeded).toBe(1);
      expect(data.failed).toBe(3);

      const resultsMap = new Map(data.results.map((r: any) => [r.id, r]));

      // Valid ID succeeded
      expect(resultsMap.get(validUser.id)?.ok).toBe(true);

      // Self ID failed
      expect(resultsMap.get(actor.id)?.ok).toBe(false);
      expect(resultsMap.get(actor.id)?.error).toContain('own account');

      // Super Admin ID failed
      expect(resultsMap.get(superAdmin.id)?.ok).toBe(false);
      expect(resultsMap.get(superAdmin.id)?.error).toContain('Super Admin');

      // Other Municipality ID failed
      expect(resultsMap.get(otherMunUser.id)?.ok).toBe(false);
      expect(resultsMap.get(otherMunUser.id)?.error).toContain('different municipality');
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [actor.id, validUser.id, superAdmin.id, otherMunUser.id] } } });
    }
  });

  // ── 5. Suspend/Deactivate Invalidates Active Sessions ───────────────────────
  test('bulk suspend immediately invalidates active sessions mid-flight (403)', async ({ request }) => {
    const { cookie: adminCookie, admin } = await getAdminSession();

    // Create an active citizen in DB
    const timestamp = Date.now();
    const citizen = await prisma.user.create({
      data: {
        name: `Session Target Citizen ${timestamp}`,
        email: `session_target_${timestamp}@example.com`,
        mobileNumber: `98${timestamp.toString().slice(-8)}`,
        role: UserRole.CITIZEN,
        authProvider: AuthProvider.MOBILE_OTP,
        isAuthorized: true,
        isSuspended: false,
        municipalityId: admin.municipalityId,
      },
    });

    const citizenToken = makeJwt(citizen);
    const citizenCookie = `ic_access_token=${citizenToken}`;

    try {
      // 1. Initial request with token succeeds
      const checkRes = await request.get(`${BASE}/api/citizen/profile`, {
        headers: { cookie: citizenCookie },
      });
      expect(checkRes.status()).toBe(200);

      // 2. Admin performs bulk suspend on citizen
      const bulkRes = await request.post(`${BASE}/api/admin/citizens/bulk`, {
        headers: { cookie: adminCookie },
        data: { action: 'SUSPEND', ids: [citizen.id] },
      });
      expect(bulkRes.status()).toBe(200);
      const bulkData = await bulkRes.json();
      expect(bulkData.succeeded).toBe(1);

      // 3. Subsequent request with the SAME token must be rejected with 403 Forbidden
      const rejectedRes = await request.get(`${BASE}/api/citizen/profile`, {
        headers: { cookie: citizenCookie },
      });
      expect(rejectedRes.status()).toBe(403);
      const rejectedBody = await rejectedRes.json();
      expect(rejectedBody.message).toContain('suspended');
    } finally {
      await prisma.user.delete({ where: { id: citizen.id } }).catch(() => {});
    }
  });

  // ── 6. Field Worker with Repair Photos Deleted -> Option A Evidence ──────────
  test('deleting field worker preserves repair photos with uploadedByName and nulled FK', async ({ request }) => {
    const { cookie: adminCookie, admin } = await getAdminSession();

    // Fetch department
    const dept = await prisma.department.findFirst();

    // 1. Create a field worker
    const timestamp = Date.now();
    const fieldWorker = await prisma.user.create({
      data: {
        name: `Ramesh Field Worker ${timestamp}`,
        email: `ramesh_fw_${timestamp}@smartcity.gov.in`,
        role: UserRole.FIELD_WORKER,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: true,
        departmentId: dept?.id,
        municipalityId: admin.municipalityId,
      },
    });

    // 2. Create a citizen and complaint
    const citizen = await prisma.user.create({
      data: {
        name: `Citizen For Photo ${timestamp}`,
        mobileNumber: `91${timestamp.toString().slice(-8)}`,
        role: UserRole.CITIZEN,
        authProvider: AuthProvider.MOBILE_OTP,
        isAuthorized: true,
        municipalityId: admin.municipalityId,
      },
    });

    const complaint = await prisma.complaint.create({
      data: {
        ticketId: `TCK-EVID-${timestamp}`,
        citizenId: citizen.id,
        title: 'Pothole on Main Road',
        description: 'Road needs repair',
        status: 'RESOLVED', // Marked resolved so staff member has no open complaints blocking deletion
        municipalityId: admin.municipalityId,
        departmentId: dept?.id,
      },
    });

    // 3. Create evidence photo uploaded by this field worker
    const evidence = await prisma.evidence.create({
      data: {
        complaintId: complaint.id,
        stage: EvidenceStage.AFTER,
        imageUrl: 'https://storage.googleapis.com/intellicivic/repair_after.jpg',
        uploadedByUserId: fieldWorker.id,
        notes: 'Pothole filled and sealed with asphalt',
      },
    });

    try {
      // 4. Delete the field worker via bulk delete (Option A)
      const delRes = await request.post(`${BASE}/api/admin/staff/bulk`, {
        headers: { cookie: adminCookie },
        data: { action: 'DELETE', ids: [fieldWorker.id] },
      });
      expect(delRes.status()).toBe(200);
      const delData = await delRes.json();
      expect(delData.succeeded).toBe(1);

      // 5. Verify field worker is deleted from users table
      const userInDb = await prisma.user.findUnique({ where: { id: fieldWorker.id } });
      expect(userInDb).toBeNull();

      // 6. Verify Evidence row STILL EXISTS and has uploadedByName populated & uploadedByUserId = null
      const evidenceInDb = await prisma.evidence.findUnique({
        where: { id: evidence.id },
      });
      expect(evidenceInDb).not.toBeNull();
      expect(evidenceInDb?.uploadedByUserId).toBeNull();
      expect(evidenceInDb?.uploadedByName).toBe(`Ramesh Field Worker ${timestamp}`);
      expect(evidenceInDb?.imageUrl).toBe('https://storage.googleapis.com/intellicivic/repair_after.jpg');
    } finally {
      await prisma.evidence.deleteMany({ where: { complaintId: complaint.id } });
      await prisma.complaint.delete({ where: { id: complaint.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: citizen.id } }).catch(() => {});
      const remainingFw = await prisma.user.findUnique({ where: { id: fieldWorker.id } });
      if (remainingFw) {
        await prisma.user.delete({ where: { id: fieldWorker.id } }).catch(() => {});
      }
    }
  });

  // ── 7. UI: Sticky Bar and Confirmation Dialog for Bulk Delete ────────────────
  test('UI: selecting rows shows sticky bar with count, and bulk delete requires confirm dialog', async ({ page }) => {
    const { token } = await getAdminSession();

    await page.context().addCookies([
      {
        name: 'ic_access_token',
        value: token,
        url: 'http://localhost:3000',
      },
    ]);

    // Navigate to /admin/staff
    await page.goto('/admin/staff');
    await page.waitForLoadState('domcontentloaded');

    // Wait for staff table rows
    const checkboxes = page.locator('table tbody tr input[type="checkbox"]');
    await checkboxes.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);

    // Click first checkbox
    await checkboxes.first().click();

    // Verify sticky action bar appears with "1 selected"
    const stickyBar = page.locator('[data-testid="bulk-action-bar"]');
    await expect(stickyBar).toBeVisible();
    await expect(stickyBar).toContainText('1 selected');

    // Click "Delete" button in sticky bar
    const deleteBtn = stickyBar.getByRole('button', { name: 'Delete' });
    await deleteBtn.click();

    // Confirm dialog must appear showing the count
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Confirm Bulk Deletion');
    await expect(confirmDialog).toContainText('1');

    // Click "Cancel" in confirm dialog
    const cancelBtn = confirmDialog.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();

    // Dialog closes
    await expect(confirmDialog).not.toBeVisible();
  });

  // ── 8. Outcome: Citizens bulk DELETE and RESTORE ────────────────────────────
  test('outcome: citizens bulk DELETE and RESTORE', async ({ request }) => {
    const { cookie, admin } = await getAdminSession();
    const timestamp = Date.now();

    const c1 = await prisma.user.create({
      data: {
        name: `Bulk Citizen Test 1 ${timestamp}`,
        mobileNumber: `98${timestamp.toString().slice(-8)}`,
        role: UserRole.CITIZEN,
        authProvider: AuthProvider.MOBILE_OTP,
        isAuthorized: true,
        municipalityId: admin.municipalityId,
      },
    });

    const c2 = await prisma.user.create({
      data: {
        name: `Bulk Citizen Test 2 ${timestamp}`,
        mobileNumber: `97${timestamp.toString().slice(-8)}`,
        role: UserRole.CITIZEN,
        authProvider: AuthProvider.MOBILE_OTP,
        isAuthorized: true,
        municipalityId: admin.municipalityId,
      },
    });

    const targetIds = [c1.id, c2.id];

    try {
      // 1. Bulk DELETE
      const delRes = await request.post(`${BASE}/api/admin/citizens/bulk`, {
        headers: { cookie },
        data: { action: 'DELETE', ids: targetIds },
      });
      expect(delRes.status()).toBe(200);
      const delData = await delRes.json();
      expect(delData.ok).toBe(true);
      expect(delData.succeeded).toBe(2);
      expect(delData.failed).toBe(0);

      // Verify soft-deleted in DB
      const deletedInDb = await prisma.user.findMany({ where: { id: { in: targetIds } } });
      expect(deletedInDb.length).toBe(2);
      for (const u of deletedInDb) {
        expect(u.deletedAt).not.toBeNull();
        expect(u.isSuspended).toBe(true);
      }

      // 2. Bulk RESTORE
      const restoreRes = await request.post(`${BASE}/api/admin/citizens/bulk`, {
        headers: { cookie },
        data: { action: 'RESTORE', ids: targetIds },
      });
      expect(restoreRes.status()).toBe(200);
      const restoreData = await restoreRes.json();
      expect(restoreData.ok).toBe(true);
      expect(restoreData.succeeded).toBe(2);
      expect(restoreData.failed).toBe(0);

      // Verify restored in DB
      const restoredInDb = await prisma.user.findMany({ where: { id: { in: targetIds } } });
      expect(restoredInDb.length).toBe(2);
      for (const u of restoredInDb) {
        expect(u.deletedAt).toBeNull();
        expect(u.isSuspended).toBe(false);
      }
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: targetIds } } });
      await prisma.user.deleteMany({ where: { id: { in: targetIds } } });
    }
  });

  // ── 9. Outcome: Staff bulk DELETE refused (STAFF_HAS_FIELD_WORKERS & STAFF_HAS_OPEN_COMPLAINTS) ──
  test('outcome: staff bulk DELETE refused with STAFF_HAS_FIELD_WORKERS and STAFF_HAS_OPEN_COMPLAINTS', async ({ request }) => {
    const { cookie, admin } = await getAdminSession();
    const timestamp = Date.now();
    const dept = await prisma.department.findFirst();

    // 1. Officer with assigned field worker -> STAFF_HAS_FIELD_WORKERS
    const officer = await prisma.user.create({
      data: {
        name: `Officer With Worker ${timestamp}`,
        email: `officer_worker_${timestamp}@smartcity.gov.in`,
        role: UserRole.DEPARTMENT_OFFICER,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: true,
        departmentId: dept?.id,
        municipalityId: admin.municipalityId,
      },
    });

    const subordinateWorker = await prisma.user.create({
      data: {
        name: `Subordinate Worker ${timestamp}`,
        email: `sub_worker_${timestamp}@smartcity.gov.in`,
        role: UserRole.FIELD_WORKER,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: true,
        assignedOfficerId: officer.id,
        departmentId: dept?.id,
        municipalityId: admin.municipalityId,
      },
    });

    // 2. Field worker with an open complaint -> STAFF_HAS_OPEN_COMPLAINTS
    const workerWithComplaint = await prisma.user.create({
      data: {
        name: `Worker With Complaint ${timestamp}`,
        email: `worker_complaint_${timestamp}@smartcity.gov.in`,
        role: UserRole.FIELD_WORKER,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: true,
        departmentId: dept?.id,
        municipalityId: admin.municipalityId,
      },
    });

    const openComplaint = await prisma.complaint.create({
      data: {
        ticketId: `TCK-REFUSE-${timestamp}`,
        citizenId: admin.id,
        title: 'Open Street Light Malfunction',
        description: 'Street light broken',
        status: 'IN_PROGRESS',
        assignedFieldWorkerId: workerWithComplaint.id,
        departmentId: dept?.id,
        municipalityId: admin.municipalityId,
      },
    });

    try {
      // Try bulk delete on both
      const delRes = await request.post(`${BASE}/api/admin/staff/bulk`, {
        headers: { cookie },
        data: { action: 'DELETE', ids: [officer.id, workerWithComplaint.id] },
      });
      expect(delRes.status()).toBe(200);
      const delData = await delRes.json();
      expect(delData.ok).toBe(true);
      expect(delData.failed).toBe(2);
      expect(delData.succeeded).toBe(0);

      const officerResult = delData.results.find((r: any) => r.id === officer.id);
      expect(officerResult?.ok).toBe(false);
      expect(officerResult?.error).toContain('assigned field worker');

      const workerResult = delData.results.find((r: any) => r.id === workerWithComplaint.id);
      expect(workerResult?.ok).toBe(false);
      expect(workerResult?.error).toContain('open complaint');
    } finally {
      await prisma.complaint.delete({ where: { id: openComplaint.id } }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: [subordinateWorker.id, workerWithComplaint.id, officer.id] } },
      }).catch(() => {});
    }
  });

  // ── 10. Outcome: REASSIGN_DEPT skipping FIELD_WORKER ids with a reason ─────
  test('outcome: REASSIGN_DEPT skipping FIELD_WORKER ids with a reason', async ({ request }) => {
    const { cookie, admin } = await getAdminSession();
    const timestamp = Date.now();
    const dept = await prisma.department.findFirst();

    const fieldWorker = await prisma.user.create({
      data: {
        name: `Skip Worker ${timestamp}`,
        email: `skip_fw_${timestamp}@smartcity.gov.in`,
        role: UserRole.FIELD_WORKER,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: true,
        departmentId: dept?.id,
        municipalityId: admin.municipalityId,
      },
    });

    try {
      const res = await request.post(`${BASE}/api/admin/staff/bulk`, {
        headers: { cookie },
        data: {
          action: 'REASSIGN_DEPT',
          ids: [fieldWorker.id],
          departmentId: dept?.id,
        },
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.failed).toBe(1);
      expect(data.succeeded).toBe(0);

      const fwResult = data.results.find((r: any) => r.id === fieldWorker.id);
      expect(fwResult?.ok).toBe(false);
      expect(fwResult?.error).toBe('needs officer in target department');
    } finally {
      await prisma.user.delete({ where: { id: fieldWorker.id } }).catch(() => {});
    }
  });

  // ── 11. Outcome: pending APPROVE (role + department) and REJECT ───────────
  test('outcome: pending APPROVE (role + department) and REJECT', async ({ request }) => {
    const { cookie, admin } = await getAdminSession();
    const timestamp = Date.now();
    const dept = await prisma.department.findFirst();

    const pendingUser1 = await prisma.user.create({
      data: {
        name: `Pending Staff Approve ${timestamp}`,
        email: `pending_app_${timestamp}@smartcity.gov.in`,
        role: UserRole.DEPARTMENT_OFFICER,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: false,
        municipalityId: admin.municipalityId,
      },
    });

    const pendingUser2 = await prisma.user.create({
      data: {
        name: `Pending Staff Reject ${timestamp}`,
        email: `pending_rej_${timestamp}@smartcity.gov.in`,
        role: UserRole.DEPARTMENT_OFFICER,
        authProvider: AuthProvider.GOOGLE,
        isAuthorized: false,
        municipalityId: admin.municipalityId,
      },
    });

    try {
      // 1. Bulk APPROVE with role + department
      const appRes = await request.post(`${BASE}/api/admin/users/pending/bulk`, {
        headers: { cookie },
        data: {
          action: 'APPROVE',
          ids: [pendingUser1.id],
          role: 'DEPARTMENT_OFFICER',
          departmentId: dept?.id,
        },
      });
      expect(appRes.status()).toBe(200);
      const appData = await appRes.json();
      expect(appData.ok).toBe(true);
      expect(appData.succeeded).toBe(1);
      expect(appData.failed).toBe(0);

      // Verify in DB
      const user1Db = await prisma.user.findUnique({ where: { id: pendingUser1.id } });
      expect(user1Db?.isAuthorized).toBe(true);
      expect(user1Db?.role).toBe(UserRole.DEPARTMENT_OFFICER);
      expect(user1Db?.departmentId).toBe(dept?.id);

      // 2. Bulk REJECT
      const rejRes = await request.post(`${BASE}/api/admin/users/pending/bulk`, {
        headers: { cookie },
        data: {
          action: 'REJECT',
          ids: [pendingUser2.id],
        },
      });
      expect(rejRes.status()).toBe(200);
      const rejData = await rejRes.json();
      expect(rejData.ok).toBe(true);
      expect(rejData.succeeded).toBe(1);
      expect(rejData.failed).toBe(0);

      // Verify deleted from DB
      const user2Db = await prisma.user.findUnique({ where: { id: pendingUser2.id } });
      expect(user2Db).toBeNull();
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: [pendingUser1.id, pendingUser2.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [pendingUser1.id, pendingUser2.id] } } }).catch(() => {});
    }
  });
});
