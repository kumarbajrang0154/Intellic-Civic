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
    throw new Error(`No ic_access_token found. dev-login: ${res.status()}, headers: ${JSON.stringify(res.headers())}`);
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

test.describe('Staff & User Management: Lifecycle, Preflight & Safety', () => {
  test.setTimeout(60000);

  test.beforeAll(async () => {
    await ensureSuperAdminUser();
  });

  test('1. Conflict 409 explains itself and returns full metadata & shows popup in UI', async ({ page, request }) => {
    const cookie = await getAdminContext(request);

    // 1a: Check API 409 conflict returns metadata for 23cs025@kpriet.ac.in
    const res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        name: 'Conflict Test User',
        email: '23cs025@kpriet.ac.in',
        role: 'DEPARTMENT_HEAD',
      },
    });

    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body).toHaveProperty('conflict');
    expect(body.conflict).toHaveProperty('status');
    expect(body.conflict).toHaveProperty('municipality');
    expect(body.conflict).toHaveProperty('email');
    expect(body.conflict.email.toLowerCase()).toBe('23cs025@kpriet.ac.in');

    // DB assertion
    const dbUser = await prisma.user.findFirst({
      where: { email: { equals: '23cs025@kpriet.ac.in', mode: 'insensitive' } },
    });
    expect(dbUser).not.toBeNull();
    expect(body.conflict.id).toBe(dbUser?.id);

    // 1b: Verify UI Popup shows existing role / status in plain language
    await page.context().addCookies([{
      name: 'ic_access_token',
      value: cookie.replace('ic_access_token=', ''),
      domain: 'localhost',
      path: '/',
    }]);

    await page.goto(`${BASE}/admin/staff`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Create Staff' }).click();
    const nameInput = page.getByPlaceholder('e.g. Amit Sharma');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Conflict Test UI');
    await page.getByPlaceholder('e.g. amit.sharma@smartcity.gov.in').fill('23cs025@kpriet.ac.in');
    // Select DEPARTMENT_HEAD so department assignment is not required
    await page.locator('div[role="dialog"]').locator('select').first().selectOption('DEPARTMENT_HEAD');
    await page.locator('div[role="dialog"]').getByRole('button', { name: 'Create Staff' }).click();

    // Verify popup appears with plain language explanation
    await expect(page.getByText('Email Already Registered')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/This email is already a.*account in/i)).toBeVisible();
    await expect(page.getByText('23cs025@kpriet.ac.in', { exact: true })).toBeVisible();
  });

  test('2. Delete blocked with reasons for staff with assigned complaints', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const mun = await getDefaultMunicipality();

    const officer = await prisma.user.findFirst({
      where: { role: 'DEPARTMENT_OFFICER', departmentId: { not: null }, isSuspended: false },
    });
    const dept = officer?.departmentId
      ? await prisma.department.findUnique({ where: { id: officer.departmentId } })
      : await prisma.department.findFirst({ where: { municipalityId: mun.id } });

    // Create staff member
    const staffEmail = `blocked_staff_${Date.now()}@smartcity.gov.in`;
    const createStaffRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        name: 'Blocked Staff',
        email: staffEmail,
        role: 'FIELD_WORKER',
        departmentId: dept?.id,
        assignedOfficerId: officer?.id,
      },
    });
    expect(createStaffRes.status()).toBe(201);
    const { staff } = await createStaffRes.json();

    // Create an open complaint assigned to this staff
    const citizen = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
    const category = await prisma.category.findFirst();
    const complaint = await prisma.complaint.create({
      data: {
        ticketId: `BLK-${Date.now().toString().slice(-6)}`,
        title: 'Open Complaint Blocking Delete',
        description: 'Test Blocker',
        status: 'ASSIGNED',
        municipalityId: mun.id,
        departmentId: dept?.id,
        categoryId: category?.id,
        citizenId: citizen!.id,
        assignedFieldWorkerId: staff.id,
      },
    });

    // Call Preflight endpoint
    const preflightRes = await request.get(`${BASE}/api/admin/users/${staff.id}/delete-preflight`, {
      headers: { cookie },
    });
    expect(preflightRes.status()).toBe(200);
    const preflight = await preflightRes.json();
    expect(preflight.canHardDelete).toBe(false);
    expect(preflight.blockers.openAssignedComplaints).toBeGreaterThanOrEqual(1);
    expect(preflight.reasons.length).toBeGreaterThanOrEqual(1);

    // Call DELETE endpoint
    const deleteRes = await request.delete(`${BASE}/api/admin/staff/${staff.id}`, {
      headers: { cookie },
    });
    expect(deleteRes.status()).toBe(409);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.message).toContain('open assigned complaint');
    expect(deleteBody.blockers.openAssignedComplaints).toBeGreaterThanOrEqual(1);

    // DB Assertion: user still exists and not hard deleted
    const checkUser = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(checkUser).not.toBeNull();
    expect(checkUser?.deletedAt).toBeNull();

    // Cleanup complaint
    await prisma.complaint.delete({ where: { id: complaint.id } });
    await prisma.user.delete({ where: { id: staff.id } });
  });

  test('3. Reassign-then-delete works cleanly', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const mun = await getDefaultMunicipality();

    const officer = await prisma.user.findFirst({
      where: { role: 'DEPARTMENT_OFFICER', departmentId: { not: null }, isSuspended: false },
    });
    const dept = officer?.departmentId
      ? await prisma.department.findUnique({ where: { id: officer.departmentId } })
      : await prisma.department.findFirst({ where: { municipalityId: mun.id } });

    // Create source staff
    const staff1Res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        name: 'Reassign Source Staff',
        email: `reassign_src_${Date.now()}@smartcity.gov.in`,
        role: 'FIELD_WORKER',
        departmentId: dept?.id,
        assignedOfficerId: officer?.id,
      },
    });
    expect(staff1Res.status()).toBe(201);
    const staff1 = (await staff1Res.json()).staff;

    // Create target staff
    const staff2Res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        name: 'Reassign Target Staff',
        email: `reassign_tgt_${Date.now()}@smartcity.gov.in`,
        role: 'FIELD_WORKER',
        departmentId: dept?.id,
        assignedOfficerId: officer?.id,
      },
    });
    expect(staff2Res.status()).toBe(201);
    const staff2 = (await staff2Res.json()).staff;

    // Assign open complaint to staff1
    const citizen = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
    const category = await prisma.category.findFirst();
    const complaint = await prisma.complaint.create({
      data: {
        ticketId: `REASSIGN-${Date.now().toString().slice(-6)}`,
        title: 'Complaint to Reassign',
        description: 'Test Reassign',
        status: 'ASSIGNED',
        municipalityId: mun.id,
        departmentId: dept?.id,
        categoryId: category?.id,
        citizenId: citizen!.id,
        assignedFieldWorkerId: staff1.id,
      },
    });

    // Reassign open complaints from staff1 to staff2
    const reassignRes = await request.post(`${BASE}/api/admin/users/${staff1.id}/reassign-complaints`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { targetStaffId: staff2.id },
    });
    expect(reassignRes.status()).toBe(200);
    const reassignBody = await reassignRes.json();
    expect(reassignBody.reassignedCount).toBeGreaterThanOrEqual(1);

    // DB Assertion: complaint assignedFieldWorkerId is now staff2
    const updatedComplaint = await prisma.complaint.findUnique({ where: { id: complaint.id } });
    expect(updatedComplaint?.assignedFieldWorkerId).toBe(staff2.id);

    // Preflight for staff1 should now show 0 open complaints
    const preflight = await (await request.get(`${BASE}/api/admin/users/${staff1.id}/delete-preflight`, {
      headers: { cookie },
    })).json();
    expect(preflight.blockers.openAssignedComplaints).toBe(0);

    // Delete staff1: since staff1 has an audit row from creation, archive or clean delete
    // Cleanup the single audit log for staff1 to test hard delete at zero blockers
    await prisma.auditLog.deleteMany({ where: { entityId: staff1.id } });
    await prisma.auditLog.deleteMany({ where: { userId: staff1.id } });

    const deleteRes = await request.delete(`${BASE}/api/admin/staff/${staff1.id}`, {
      headers: { cookie },
    });
    expect(deleteRes.status()).toBe(200);
    expect((await deleteRes.json()).deleted).toBe(true);

    // DB Assertion: staff1 is completely gone from DB
    const deletedUser = await prisma.user.findUnique({ where: { id: staff1.id } });
    expect(deletedUser).toBeNull();

    // Cleanup
    await prisma.complaint.delete({ where: { id: complaint.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: staff2.id } });
    await prisma.auditLog.deleteMany({ where: { userId: staff2.id } });
    await prisma.user.delete({ where: { id: staff2.id } });
  });

  test('4. Archive frees the email and a new staff can use it', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const mun = await getDefaultMunicipality();
    const dept = await prisma.department.findFirst({ where: { municipalityId: mun.id } }) || await prisma.department.findFirst();

    const targetEmail = `archive_free_${Date.now()}@smartcity.gov.in`;

    // Create staff member
    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        name: 'Archive Me User',
        email: targetEmail,
        role: 'DEPARTMENT_HEAD',
        departmentId: dept?.id,
      },
    });
    expect(createRes.status()).toBe(201);
    const staff = (await createRes.json()).staff;

    // Archive the user via POST /api/admin/users/[id]/archive
    const archiveRes = await request.post(`${BASE}/api/admin/users/${staff.id}/archive`, {
      headers: { cookie },
    });
    expect(archiveRes.status()).toBe(200);
    const archiveBody = await archiveRes.json();
    expect(archiveBody.archived).toBe(true);
    expect(archiveBody.originalEmail).toBe(targetEmail);
    expect(archiveBody.tombstoneEmail).toContain('archived_');

    // DB Assertion: user row is archived with tombstone email
    const archivedDbUser = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(archivedDbUser?.deletedAt).not.toBeNull();
    expect(archivedDbUser?.isSuspended).toBe(true);
    expect(archivedDbUser?.email).not.toBe(targetEmail);
    expect(archivedDbUser?.email).toContain('archived_');

    // Recreate staff with the SAME original email address!
    const recreateRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        name: 'New Reborn Staff',
        email: targetEmail,
        role: 'DEPARTMENT_HEAD',
        departmentId: dept?.id,
      },
    });
    expect(recreateRes.status()).toBe(201);
    const newStaff = (await recreateRes.json()).staff;
    expect(newStaff.email).toBe(targetEmail);
    expect(newStaff.id).not.toBe(staff.id);

    // DB Assertion: active user exists with targetEmail
    const activeDbUser = await prisma.user.findUnique({ where: { id: newStaff.id } });
    expect(activeDbUser?.email).toBe(targetEmail);
    expect(activeDbUser?.deletedAt).toBeNull();

    // Cleanup
    await prisma.user.delete({ where: { id: newStaff.id } });
    await prisma.user.delete({ where: { id: staff.id } });
  });

  test('5. Hard delete only succeeds at zero blockers', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const mun = await getDefaultMunicipality();

    // Create a pristine user with no complaints, no logs
    const zeroBlockerUser = await prisma.user.create({
      data: {
        name: 'Zero Blocker Staff',
        email: `zero_blocker_${Date.now()}@smartcity.gov.in`,
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: mun.id,
      },
    });

    // Check preflight: must be canHardDelete === true
    const preflight = await (await request.get(`${BASE}/api/admin/users/${zeroBlockerUser.id}/delete-preflight`, {
      headers: { cookie },
    })).json();
    expect(preflight.canHardDelete).toBe(true);
    expect(preflight.reasons).toHaveLength(0);

    // Hard delete
    const delRes = await request.delete(`${BASE}/api/admin/staff/${zeroBlockerUser.id}`, {
      headers: { cookie },
    });
    expect(delRes.status()).toBe(200);

    // DB Assertion: record deleted from DB
    const check = await prisma.user.findUnique({ where: { id: zeroBlockerUser.id } });
    expect(check).toBeNull();
  });

  test('6. Non-admin gets 403 on protected operations', async ({ request }) => {
    const nonAdminCookie = await getNonAdminContext(request);

    // Preflight
    const pRes = await request.get(`${BASE}/api/admin/users/dummy-id/delete-preflight`, {
      headers: { cookie: nonAdminCookie },
    });
    expect(pRes.status()).toBe(403);

    // Archive
    const aRes = await request.post(`${BASE}/api/admin/users/dummy-id/archive`, {
      headers: { cookie: nonAdminCookie },
    });
    expect(aRes.status()).toBe(403);

    // Reassign complaints
    const rRes = await request.post(`${BASE}/api/admin/users/dummy-id/reassign-complaints`, {
      headers: { cookie: nonAdminCookie },
      data: { targetStaffId: 'other-id' },
    });
    expect(rRes.status()).toBe(403);

    // Convert
    const cRes = await request.post(`${BASE}/api/admin/users/dummy-id/convert`, {
      headers: { cookie: nonAdminCookie },
      data: { role: 'DEPARTMENT_OFFICER' },
    });
    expect(cRes.status()).toBe(403);

    // Delete staff
    const dRes = await request.delete(`${BASE}/api/admin/staff/dummy-id`, {
      headers: { cookie: nonAdminCookie },
    });
    expect(dRes.status()).toBe(403);
  });

  test('7. Self-delete is blocked with clear reason', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const me = await (await request.get(`${BASE}/api/auth/me`, { headers: { cookie } })).json();
    const myId = me.user?.id;

    // Preflight
    const preflight = await (await request.get(`${BASE}/api/admin/users/${myId}/delete-preflight`, {
      headers: { cookie },
    })).json();
    expect(preflight.isSelf).toBe(true);
    expect(preflight.canHardDelete).toBe(false);
    expect(preflight.reasons).toContain('You cannot delete your own account.');

    // Attempt delete
    const res = await request.delete(`${BASE}/api/admin/staff/${myId}`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('You cannot delete your own account');
  });

  test('8. Citizen delete preflight and archive frees credentials and sets tombstone', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const mun = await getDefaultMunicipality();

    const citizenEmail = `citizen_archive_${Date.now()}@example.com`;
    const citizenMobile = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;

    const citizen = await prisma.user.create({
      data: {
        name: 'Citizen Archive Test',
        email: citizenEmail,
        mobileNumber: citizenMobile,
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        municipalityId: mun.id,
      },
    });

    // 8a. Preflight check
    const preflightRes = await request.get(`${BASE}/api/admin/users/${citizen.id}/delete-preflight`, {
      headers: { cookie },
    });
    expect(preflightRes.status()).toBe(200);
    const preflight = await preflightRes.json();
    expect(preflight.user.id).toBe(citizen.id);
    expect(preflight.canHardDelete).toBe(true); // zero blockers

    // 8b. Archive citizen
    const archiveRes = await request.post(`${BASE}/api/admin/users/${citizen.id}/archive`, {
      headers: { cookie },
    });
    expect(archiveRes.status()).toBe(200);
    const archiveData = await archiveRes.json();
    expect(archiveData.archived).toBe(true);
    expect(archiveData.originalEmail).toBe(citizenEmail);
    expect(archiveData.tombstoneEmail).toContain('archived_');

    // DB assertion: citizen is archived and credentials freed
    const archivedUser = await prisma.user.findUnique({ where: { id: citizen.id } });
    expect(archivedUser?.deletedAt).not.toBeNull();
    expect(archivedUser?.isSuspended).toBe(true);
    expect(archivedUser?.mobileNumber).toBeNull();
    expect(archivedUser?.email).toContain('archived_');

    // Cleanup
    await prisma.auditLog.deleteMany({ where: { entityId: citizen.id } });
    await prisma.user.delete({ where: { id: citizen.id } });
  });

  test('9. Last-ADMIN delete is strictly blocked', async ({ request }) => {
    const cookie = await getAdminContext(request);

    // Find sole active admin or create a temporary single admin scenario
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isSuspended: false, deletedAt: null },
    });

    if (admins.length === 1) {
      const soleAdmin = admins[0];
      const preflight = await (await request.get(`${BASE}/api/admin/users/${soleAdmin.id}/delete-preflight`, {
        headers: { cookie },
      })).json();
      expect(preflight.isLastAdmin).toBe(true);
      expect(preflight.canHardDelete).toBe(false);
      expect(preflight.reasons).toContain('Cannot delete the last active administrator.');

      const delRes = await request.delete(`${BASE}/api/admin/staff/${soleAdmin.id}`, {
        headers: { cookie },
      });
      expect(delRes.status()).toBe(400);
    } else {
      // Create isolated municipality admin to verify last-admin logic check
      const mun = await getDefaultMunicipality();
      const tempAdmin = await prisma.user.create({
        data: {
          name: 'Temporary Admin Tester',
          email: `temp_admin_${Date.now()}@smartcity.gov.in`,
          role: 'ADMIN',
          authProvider: 'GOOGLE',
          isAuthorized: true,
          municipalityId: mun.id,
        },
      });

      // Preflight
      const preflight = await (await request.get(`${BASE}/api/admin/users/${tempAdmin.id}/delete-preflight`, {
        headers: { cookie },
      })).json();
      // If there are other admins, isLastAdmin should be false
      expect(preflight.isLastAdmin).toBe(false);

      // Cleanup tempAdmin
      await prisma.user.delete({ where: { id: tempAdmin.id } });
    }
  });

  test('10. Audit row asserted for archive, reassign and convert', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const mun = await getDefaultMunicipality();
    const dept = await prisma.department.findFirst({ where: { municipalityId: mun.id } }) || await prisma.department.findFirst();

    // 10a. Convert citizen -> staff and assert audit row
    const convertCitizen = await prisma.user.create({
      data: {
        name: 'Convert Audit Tester',
        email: `convert_audit_${Date.now()}@example.com`,
        role: 'CITIZEN',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        municipalityId: mun.id,
      },
    });

    const convertRes = await request.post(`${BASE}/api/admin/users/${convertCitizen.id}/convert`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        role: 'DEPARTMENT_OFFICER',
        departmentId: dept?.id,
      },
    });
    expect(convertRes.status()).toBe(200);

    const convertAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'USER_CONVERTED_TO_STAFF',
        entityId: convertCitizen.id,
      },
    });
    expect(convertAudit).not.toBeNull();
    expect(convertAudit?.action).toBe('USER_CONVERTED_TO_STAFF');

    // 10b. Reassign open complaint and assert audit row
    const receiverStaff = await prisma.user.create({
      data: {
        name: 'Receiver Staff',
        email: `receiver_${Date.now()}@smartcity.gov.in`,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
        departmentId: dept?.id,
        municipalityId: mun.id,
      },
    });

    const reassignRes = await request.post(`${BASE}/api/admin/users/${convertCitizen.id}/reassign-complaints`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { targetStaffId: receiverStaff.id },
    });
    expect(reassignRes.status()).toBe(200);

    const reassignAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'COMPLAINTS_REASSIGNED',
        entityId: convertCitizen.id,
      },
    });
    expect(reassignAudit).not.toBeNull();
    expect(reassignAudit?.action).toBe('COMPLAINTS_REASSIGNED');

    // 10c. Archive and assert audit row
    const archiveRes = await request.post(`${BASE}/api/admin/users/${convertCitizen.id}/archive`, {
      headers: { cookie },
    });
    expect(archiveRes.status()).toBe(200);

    const archiveAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'USER_ARCHIVED',
        entityId: convertCitizen.id,
      },
    });
    expect(archiveAudit).not.toBeNull();
    expect(archiveAudit?.action).toBe('USER_ARCHIVED');

    // Cleanup
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [convertCitizen.id, receiverStaff.id] } } });
    await prisma.user.delete({ where: { id: receiverStaff.id } });
    await prisma.user.delete({ where: { id: convertCitizen.id } });
  });

});
