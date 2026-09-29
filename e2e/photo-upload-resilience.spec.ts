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

test.describe('Priority 4: Photo Evidence Upload Resilience', () => {
  test('Complaint submission with Base64 photo fallback under limit succeeds cleanly', async ({ page }) => {
    // 1. Create a citizen user
    const citizen = await prisma.user.create({
      data: {
        name: 'Photo Upload Citizen',
        mobileNumber: `97${Date.now().toString().slice(-8)}`,
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
      },
    });

    const token = await createMockJwt(citizen.id);

    // Small 1x1 WebP base64 image data URL (~100 bytes)
    const smallBase64Image = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=';

    // 2. Submit complaint with small base64 image
    const response = await page.request.post('/api/complaints', {
      headers: { Cookie: `ic_access_token=${token}` },
      data: {
        title: 'Water leak photo evidence test',
        description: 'Testing base64 photo upload submission pipeline with small image payload.',
        imageUrl: smallBase64Image,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeTruthy();
    expect(body.aiPrediction).toBeDefined();

    // 3. Cleanup
    await prisma.complaint.delete({ where: { id: body.id } });
    await prisma.user.delete({ where: { id: citizen.id } });
  });
});
