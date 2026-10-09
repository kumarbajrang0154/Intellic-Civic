import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-super-secret-jwt-key-2026');

async function createCitizenJwt() {
  return new SignJWT({
    sub: 'citizen_9876543210',
    role: 'CITIZEN',
    name: 'Voice Tester Citizen',
    mobileNumber: '9876543210',
    email: 'voicetester@example.com',
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Citizen Voice Assistant & Dictation E2E Suite', () => {
  test.beforeEach(async ({ context, page }) => {
    const token = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Install SpeechRecognition mock before page scripts run
    await page.addInitScript(() => {
      (window as any).__speechInstances = [];
      (window as any).__lastLang = null;

      class MockSpeechRecognition {
        continuous = false;
        interimResults = true;
        lang = 'en-IN';
        onstart: any = null;
        onresult: any = null;
        onerror: any = null;
        onend: any = null;
        started = false;
        stopped = false;

        start() {
          this.started = true;
          (window as any).__lastLang = this.lang;
          (window as any).__lastSpeechRecognition = this;
          (window as any).__activeSpeechRecognition = this;
          (window as any).__speechInstances.push(this);
          setTimeout(() => {
            if (this.onstart) this.onstart();
          }, 10);
        }

        stop() {
          this.stopped = true;
          if ((window as any).__activeSpeechRecognition === this) {
            (window as any).__activeSpeechRecognition = null;
          }
          setTimeout(() => {
            if (this.onend) this.onend();
          }, 10);
        }

        abort() {
          this.stop();
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;

      (window as any).__emitSpeechResult = (text: string, isFinal = true) => {
        const rec = (window as any).__activeSpeechRecognition || (window as any).__lastSpeechRecognition;
        if (rec && rec.onresult) {
          rec.onresult({
            resultIndex: 0,
            results: [
              Object.assign([{ transcript: text }], { isFinal, 0: { transcript: text } })
            ],
          });
        }
        if (isFinal && rec && rec.stop) {
          rec.stop();
        }
      };
    });

    // Mock categories API
    await page.route('/api/categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-roads', name: 'Roads & Infrastructure' },
          { id: 'cat-water', name: 'Water Supply & Drainage' },
          { id: 'cat-sanitation', name: 'Sanitation & Solid Waste' },
        ]),
      });
    });
  });

  test('Case 1: title mic -> text lands ONLY in title', async ({ page }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    const titleMic = page.getByRole('button', { name: /Dictate Title/i });
    await expect(titleMic).toBeVisible();
    await titleMic.click();

    await page.waitForTimeout(50);
    await page.evaluate(() => {
      (window as any).__emitSpeechResult('Deep pothole on MG Road');
    });

    const titleInput = page.locator('#title');
    const descInput = page.locator('#description');
    const landmarkInput = page.locator('#address');

    await expect(titleInput).toHaveValue('Deep pothole on MG Road');
    await expect(descInput).toHaveValue('');
    await expect(landmarkInput).toHaveValue('');
  });

  test('Case 2: description mic -> text lands ONLY in description', async ({ page }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    const descMic = page.getByRole('button', { name: /Dictate Description/i });
    await expect(descMic).toBeVisible();
    await descMic.click();

    await page.waitForTimeout(50);
    await page.evaluate(() => {
      (window as any).__emitSpeechResult('There is severe waterlogging and leaking drainage pipeline since morning.');
    });

    const titleInput = page.locator('#title');
    const descInput = page.locator('#description');
    const landmarkInput = page.locator('#address');

    await expect(descInput).toHaveValue('There is severe waterlogging and leaking drainage pipeline since morning.');
    await expect(titleInput).toHaveValue('');
    await expect(landmarkInput).toHaveValue('');
  });

  test('Case 3: landmark mic -> text lands ONLY in landmark', async ({ page }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    const landmarkMic = page.getByRole('button', { name: /Dictate Landmark/i });
    await expect(landmarkMic).toBeVisible();
    await landmarkMic.click();

    await page.waitForTimeout(50);
    await page.evaluate(() => {
      (window as any).__emitSpeechResult('Near central bus stand clock tower');
    });

    const titleInput = page.locator('#title');
    const descInput = page.locator('#description');
    const landmarkInput = page.locator('#address');

    await expect(landmarkInput).toHaveValue('Near central bus stand clock tower');
    await expect(titleInput).toHaveValue('');
    await expect(descInput).toHaveValue('');
  });

  test('Case 4: starting a second mic stops the first', async ({ page }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    const titleMic = page.getByRole('button', { name: /Dictate Title/i });
    await titleMic.click();
    await page.waitForTimeout(50);

    const descMic = page.getByRole('button', { name: /Dictate Description/i });
    await descMic.click();
    await page.waitForTimeout(50);

    const instancesCount = await page.evaluate(() => (window as any).__speechInstances.length);
    const firstInstanceStopped = await page.evaluate(() => (window as any).__speechInstances[0].stopped);

    expect(instancesCount).toBeGreaterThanOrEqual(2);
    expect(firstInstanceStopped).toBe(true);
  });

  test('Case 5: Speak Full Complaint with AI mocked to return {title, description, category} -> title and description filled separately', async ({ page }) => {
    await page.route('/api/citizen/voice-parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Broken Streetlight Near Park Gate',
          description: 'The street light pole near community park gate is completely dark causing safety risk at night.',
          category: 'cat-roads',
        }),
      });
    });

    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    const speakFullBtn = page.getByRole('button', { name: /Speak Full Complaint/i });
    await expect(speakFullBtn).toBeVisible();
    await speakFullBtn.click();

    await page.waitForTimeout(50);
    await page.evaluate(() => {
      (window as any).__emitSpeechResult(
        'The street light pole near community park gate is completely dark causing safety risk at night.'
      );
    });

    const titleInput = page.locator('#title');
    const descInput = page.locator('#description');

    await expect(titleInput).toHaveValue('Broken Streetlight Near Park Gate', { timeout: 5000 });
    await expect(descInput).toHaveValue(
      'The street light pole near community park gate is completely dark causing safety risk at night.'
    );
  });

  test('Case 6: Speak Full Complaint with AI mocked to FAIL (403/500) -> title = first sentence (<=80 chars), description = full transcript, visible notice, title never empty', async ({ page }) => {
    await page.route('/api/citizen/voice-parse', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI access denied' }),
      });
    });

    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    const speakFullBtn = page.getByRole('button', { name: /Speak Full Complaint/i });
    await expect(speakFullBtn).toBeVisible();
    await speakFullBtn.click();

    const longTranscript =
      'Garbage has been overflowing from municipal bin for three days creating foul smell. Stray animals are scattering trash across main road.';

    await page.waitForTimeout(50);
    await page.evaluate((text) => {
      (window as any).__emitSpeechResult(text);
    }, longTranscript);

    const titleInput = page.locator('#title');
    const descInput = page.locator('#description');

    await expect(descInput).toHaveValue(longTranscript, { timeout: 5000 });
    const titleVal = await titleInput.inputValue();
    expect(titleVal.length).toBeGreaterThan(0);
    expect(titleVal.length).toBeLessThanOrEqual(80);
    expect(titleVal).toBe('Garbage has been overflowing from municipal bin for three days creating foul');

    // Visible notice asking citizen to check the title
    const notice = page.locator('[data-testid="voice-fallback-notice"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/check the generated title/i);
  });

  test('Case 7: the chosen language is passed as recognition.lang', async ({ page }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    // Language chooser selector exists
    const langSelect = page.locator('#voice-lang-select');
    await expect(langSelect).toBeVisible();

    // Select Hindi (hi-IN)
    await langSelect.selectOption('hi-IN');

    // Click title mic
    const titleMic = page.getByRole('button', { name: /Dictate Title/i });
    await titleMic.click();

    await page.waitForTimeout(50);
    const usedLang = await page.evaluate(() => (window as any).__lastLang);
    expect(usedLang).toBe('hi-IN');
  });

  test('Case 8: repeated interim events followed by final event -> textarea has the phrase exactly once (no duplication)', async ({ page }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    const descMic = page.getByRole('button', { name: /Dictate Description/i });
    await expect(descMic).toBeVisible();
    await descMic.click();

    await page.waitForTimeout(50);
    // Emit repeated interim results for partial and full phrase, then final result
    await page.evaluate(() => {
      const rec = (window as any).__activeSpeechRecognition || (window as any).__lastSpeechRecognition;
      // First interim: partial
      rec.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: 'Broken streetlight' }], { isFinal: false, 0: { transcript: 'Broken streetlight' } })
        ],
      });
      // Second interim: longer partial
      rec.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: 'Broken streetlight near the park gate' }], { isFinal: false, 0: { transcript: 'Broken streetlight near the park gate' } })
        ],
      });
      // Third interim: repeated full text
      rec.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: 'Broken streetlight near the park gate' }], { isFinal: false, 0: { transcript: 'Broken streetlight near the park gate' } })
        ],
      });
      // Final event: isFinal = true
      rec.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: 'Broken streetlight near the park gate' }], { isFinal: true, 0: { transcript: 'Broken streetlight near the park gate' } })
        ],
      });
      if (rec.stop) rec.stop();
    });

    const descInput = page.locator('#description');
    await expect(descInput).toHaveValue('Broken streetlight near the park gate');
  });
});

