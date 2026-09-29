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

test.describe('Phase 2d (B2): Voice Dictation Permission & Error UX', () => {
  test('Simulating SpeechRecognition permission error displays user-friendly alert message', async ({ page }) => {
    // 1. Create a citizen with complete profile in database
    const timestamp = Date.now().toString();
    const mobileNumber = `95${timestamp.slice(-8)}`;
    const email = `voicetest_${timestamp}@example.com`;

    const citizen = await prisma.user.create({
      data: {
        name: 'Voice Test Citizen',
        mobileNumber,
        email,
        address: '123 Test Street',
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        isSuspended: false,
      },
    });

    const token = await createMockJwt(citizen.id, 'CITIZEN', true);

    await page.context().addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 2. Mock SpeechRecognition in browser context to trigger 'not-allowed' error
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = 'en-US';
        onresult: any = null;
        onerror: any = null;
        onend: any = null;

        start() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror({ error: 'not-allowed' });
            }
          }, 50);
        }

        stop() {
          if (this.onend) this.onend();
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    // 3. Navigate to new complaint page
    await page.goto('/citizen/complaints/new');

    // 4. Click 'Speak Full Complaint' button
    const speakBtn = page.getByRole('button', { name: /Speak Full Complaint/i });
    await expect(speakBtn).toBeVisible();
    await speakBtn.click();

    // 5. Verify clear user-facing error message appears
    await expect(page.getByText(/Microphone permission denied/i).first()).toBeVisible({ timeout: 5000 });

    // 6. Cleanup
    await prisma.user.delete({ where: { id: citizen.id } });
  });
});
