import { test, expect } from '@playwright/test';
import prisma from '@/lib/prisma';

async function createMockJwt(sub: string, role = 'CITIZEN', isProfileComplete = true): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub,
      role,
      isProfileComplete,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.signature`;
}

test.describe('Phase 1 C2: Complaint Delete Route & Status Guard', () => {
  const BASE = 'http://localhost:3000';

  test('1. Delete succeeds for SUBMITTED complaint & permanently removes row from DB', async ({ request }) => {
    // Setup citizen & SUBMITTED complaint in DB
    const citizen = await prisma.user.create({
      data: {
        name: 'Delete Test Citizen 1',
        mobileNumber: `91${Date.now().toString().slice(-8)}`,
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
      },
    });

    const complaint = await prisma.complaint.create({
      data: {
        ticketId: `CMP-DEL-SUB-${Date.now()}`,
        citizenId: citizen.id,
        title: 'Garbage accumulation test for deletion',
        description: 'Trash bin overflowing near park entrance.',
        status: 'SUBMITTED',
      },
    });

    const citizenToken = await createMockJwt(citizen.id, 'CITIZEN', true);

    // Call DELETE /api/complaints/[id]
    const delRes = await request.delete(`${BASE}/api/complaints/${complaint.id}`, {
      headers: { Cookie: `ic_access_token=${citizenToken}` },
    });

    expect(delRes.status()).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);
    expect(delBody.message).toContain('deleted successfully');

    // DB Proof Verification: Assert complaint row is completely gone from DB
    const dbCheck = await prisma.complaint.findUnique({
      where: { id: complaint.id },
    });
    expect(dbCheck).toBeNull();

    // Cleanup citizen
    await prisma.user.delete({ where: { id: citizen.id } }).catch(() => {});
  });

  test('2. Delete rejected with 400 Bad Request when complaint is ASSIGNED', async ({ request }) => {
    // Setup citizen & ASSIGNED complaint in DB
    const citizen = await prisma.user.create({
      data: {
        name: 'Delete Test Citizen 2',
        mobileNumber: `92${Date.now().toString().slice(-8)}`,
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
      },
    });

    const complaint = await prisma.complaint.create({
      data: {
        ticketId: `CMP-DEL-ASN-${Date.now()}`,
        citizenId: citizen.id,
        title: 'Assigned complaint deletion block test',
        description: 'Pothole repair assigned to road department.',
        status: 'ASSIGNED',
      },
    });

    const citizenToken = await createMockJwt(citizen.id, 'CITIZEN', true);

    // Call DELETE /api/complaints/[id] on ASSIGNED complaint
    const delRes = await request.delete(`${BASE}/api/complaints/${complaint.id}`, {
      headers: { Cookie: `ic_access_token=${citizenToken}` },
    });

    expect(delRes.status()).toBe(400);
    const delBody = await delRes.json();
    expect(delBody.message).toBe('This complaint is already being processed and can no longer be deleted.');

    // DB Proof Verification: Assert complaint row STILL EXISTS in DB
    const dbCheck = await prisma.complaint.findUnique({
      where: { id: complaint.id },
    });
    expect(dbCheck).not.toBeNull();
    expect(dbCheck?.id).toBe(complaint.id);

    // Cleanup
    await prisma.complaint.delete({ where: { id: complaint.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: citizen.id } }).catch(() => {});
  });
});
