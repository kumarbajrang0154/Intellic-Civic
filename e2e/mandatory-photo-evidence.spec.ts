import { test, expect } from '@playwright/test';
import prisma from '@/lib/prisma';

async function createMockJwt(sub: string, role = 'CITIZEN'): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub,
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.signature`;
}

test.describe('Phase 2a (C1): Mandatory Photo Evidence Enforcement', () => {
  test('Submit complaint with 0 photos is rejected at API level with 400 Bad Request', async ({ request }) => {
    const citizen = await prisma.user.findFirst({
      where: { role: 'CITIZEN', isSuspended: false },
    });
    expect(citizen).toBeTruthy();

    const token = await createMockJwt(citizen!.id, 'CITIZEN');

    const res = await request.post('/api/complaints', {
      headers: { Cookie: `ic_access_token=${token}` },
      data: {
        title: 'Zero photo complaint test',
        description: 'Testing that submitting a complaint with zero photos is rejected with 400.',
        evidence: [],
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('At least 1 photo evidence is required');
  });

  test('Submit complaint with 1+ photos succeeds at API level with 201 Created', async ({ request }) => {
    const citizen = await prisma.user.findFirst({
      where: { role: 'CITIZEN', isSuspended: false },
    });
    expect(citizen).toBeTruthy();

    const token = await createMockJwt(citizen!.id, 'CITIZEN');

    const res = await request.post('/api/complaints', {
      headers: { Cookie: `ic_access_token=${token}` },
      data: {
        title: 'Mandatory photo test with valid evidence',
        description: 'Testing complaint submission with attached valid photo evidence URL.',
        evidence: ['https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600'],
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();

    // Clean up created complaint
    if (body.id) {
      await prisma.complaint.delete({ where: { id: body.id } }).catch(() => {});
    }
  });
});
