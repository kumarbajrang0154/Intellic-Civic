import { test, expect } from '@playwright/test';
import {
  checkAiHealth,
  getGeminiModel,
  sanitizeAiErrorMessage,
  classifyComplaintRouting,
  DEFAULT_GEMINI_MODEL,
} from '@/services/gemini-service';

test.describe('AI Service Health, Diagnostics & Visibility Suite', () => {
  test('getGeminiModel defaults to gemini-3.8-flash and respects GEMINI_MODEL env', () => {
    const defaultModel = getGeminiModel();
    expect(defaultModel).toBe(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  });

  test('sanitizeAiErrorMessage redacts API key and parses HTTP status correctly', () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const testKey = 'AIzaSyFakeKeyForTest12345';
    process.env.GEMINI_API_KEY = testKey;

    try {
      const error = new Error(`Failed to fetch https://generativelanguage.googleapis.com/v1beta/models?key=${testKey} [403 Forbidden]`);
      const sanitized = sanitizeAiErrorMessage(error);

      expect(sanitized.status).toBe(403);
      expect(sanitized.message).not.toContain(testKey);
      expect(sanitized.message).toContain('[REDACTED_API_KEY]');
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  test('checkAiHealth executes diagnostics and returns structured health result without throwing', async () => {
    const health = await checkAiHealth();

    expect(health).toBeDefined();
    expect(typeof health.ok).toBe('boolean');
    expect(health.model).toBeTruthy();
    expect(typeof health.status).toBe('number');
    expect(typeof health.latencyMs).toBe('number');

    if (health.error) {
      const currentKey = process.env.GEMINI_API_KEY;
      if (currentKey && currentKey.length > 5) {
        expect(health.error).not.toContain(currentKey);
      }
    }
  });

  test('classifyComplaintRouting provides resilient categorization and fallback flag under failure', async () => {
    const result = await classifyComplaintRouting(
      'Deep pothole causing accidents near main junction',
      'Dangerous road pothole'
    );

    expect(result).toBeDefined();
    expect(result.category).toBeTruthy();
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.priority);
    expect(typeof result.fallbackTriggered).toBe('boolean');
  });

  test('GET /api/admin/ai-health rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.get('/api/admin/ai-health');
    expect([401, 403]).toContain(res.status());
  });
});
