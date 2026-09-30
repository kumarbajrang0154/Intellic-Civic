import { test, expect } from '@playwright/test';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications-store';
import { createJwtToken } from '@/lib/auth-jwt';

test.describe('Phase 2e (B4): Real-Time Notifications Lifecycle & Polling', () => {
  test('Staff status change triggers notification record and appears in citizen notification API list', async ({ request }) => {
    // 1. Get an active complaint with citizen from DB
    const citizen = await prisma.user.findFirst({
      where: { role: 'CITIZEN', isSuspended: false },
    });
    expect(citizen).toBeTruthy();

    const complaint = await prisma.complaint.findFirst({
      where: { citizenId: citizen!.id },
    }) || await prisma.complaint.findFirst();
    expect(complaint).toBeTruthy();

    // 2. Trigger a notification via createNotification helper (simulating status update)
    const testMessage = `Test notification for ticket #${complaint!.ticketId} - status changed to RESOLVED`;
    const notification = await createNotification({
      complaintId: complaint!.id,
      recipientUserId: citizen!.id,
      type: 'RESOLVED',
      message: testMessage,
    });

    expect(notification.id).toBeTruthy();

    // 3. Query /api/notifications as citizen with valid signed JWT token
    const citizenToken = await createJwtToken({
      sub: citizen!.id,
      role: 'CITIZEN',
      mobileNumber: citizen!.mobileNumber,
      email: citizen!.email,
      isProfileComplete: true,
    });

    const apiRes = await request.get('/api/notifications', {
      headers: { Cookie: `ic_access_token=${citizenToken}` },
    });

    expect(apiRes.status()).toBe(200);
    const body = await apiRes.json();
    const notificationsList = body.items || body;
    expect(Array.isArray(notificationsList)).toBe(true);

    const found = notificationsList.find((n: any) => n.id === notification.id);
    expect(found).toBeTruthy();
    expect(found.message).toBe(testMessage);

    // 4. Cleanup created notification
    await prisma.notification.delete({ where: { id: notification.id } }).catch(() => {});
  });
});
