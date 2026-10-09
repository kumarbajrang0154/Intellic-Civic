import { test, expect } from '@playwright/test';
import {
  classifyComplaintRouting,
  verifyComplaintPhoto,
  checkAiHealth,
  getActiveAiProvider,
  getGroqModel,
  DEFAULT_CATEGORIES,
} from '@/services/ai-provider';

test.describe('Multi-Provider AI Auto-Failover & Visibility Suite', () => {
  const originalEnv = { ...process.env };

  test.beforeEach(() => {
    process.env = { ...originalEnv };
  });

  test.afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('1. Gemini OK: returns Gemini classification without failover or heuristics', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-valid-gemini-key';

    // Mock global fetch for Gemini SDK endpoint
    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        category: 'cat-roads',
                        priority: 'HIGH',
                        reasoning: 'Critical asphalt cave-in on arterial transit lane.',
                        language: 'en',
                        titleEn: null,
                        descriptionEn: null,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting(
        'Dangerous deep pothole on fast-moving junction road',
        'Large road pothole',
        DEFAULT_CATEGORIES,
      );

      expect(result.fallbackTriggered).toBe(false);
      expect(result.category).toBe('cat-roads');
      expect(result.priority).toBe('HIGH');
      expect(result.provider).toBe('gemini');
      expect(result.reasoning).toContain('Critical asphalt cave-in');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('2. Gemini 403 Forbidden -> Auto-failover to Groq succeeds cleanly', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-denied-gemini-key';
    process.env.GROQ_API_KEY = 'gsk_mock_valid_groq_key_998877';
    process.env.GROQ_MODEL = 'qwen/qwen3.8-27b';

    const originalFetch = global.fetch;
    let groqEndpointCalled = false;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      // Gemini fails with 403 Forbidden (project permission denied)
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'The caller does not have permission for the requested project [PERMISSION_DENIED]',
              status: 'PERMISSION_DENIED',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Groq succeeds with valid JSON structured output
      if (url.includes('api.groq.com/openai/v1/chat/completions')) {
        groqEndpointCalled = true;
        const requestBody = JSON.parse(init?.body as string || '{}');
        expect(requestBody.model).toBe('qwen/qwen3.8-27b');

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    category: 'cat-water',
                    priority: 'CRITICAL',
                    reasoning: 'Massive burst water main flooding street corridor.',
                    language: 'en',
                    titleEn: null,
                    descriptionEn: null,
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting(
        'Water pipe burst spraying high pressure water across roadway',
        'Pipe burst emergency',
        DEFAULT_CATEGORIES,
      );

      expect(groqEndpointCalled).toBe(true);
      expect(result.fallbackTriggered).toBe(false);
      expect(result.category).toBe('cat-water');
      expect(result.priority).toBe('CRITICAL');
      expect(result.provider).toBe('groq');
      expect(result.reasoning).toContain('Massive burst water main');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('3. Both Gemini and Groq fail -> Fallback to keyword heuristics with honest banner', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-denied-gemini-key';
    process.env.GROQ_API_KEY = 'mock-failed-groq-key';

    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      // Gemini fails with 403
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: { code: 403, message: 'Google project denied' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Groq also fails with 500
      if (url.includes('api.groq.com/openai/v1/chat/completions')) {
        return new Response(
          JSON.stringify({
            error: { message: 'Groq inference capacity temporarily unavailable' },
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting(
        'Electric transformer sparking with smoke causing extreme danger near school gate',
        'Electric wire sparking emergency danger',
        DEFAULT_CATEGORIES,
      );

      expect(result.fallbackTriggered).toBe(true);
      expect(result.category).toBe('cat-electricity');
      expect(result.priority).toBe('CRITICAL');
      expect(result.reasoning).toContain('AI unavailable — fallback used');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('4. Live health check against second provider using key from .env (never printing it)', async () => {
    // Read the actual GROQ_API_KEY from .env
    const groqKey = process.env.GROQ_API_KEY?.trim();

    process.env.AI_PROVIDER = 'groq';

    const health = await checkAiHealth();

    expect(health).toBeDefined();
    expect(health.provider).toBe('groq');
    expect(health.model).toBeTruthy();
    expect(typeof health.status).toBe('number');
    expect(typeof health.latencyMs).toBe('number');

    // Security assertion: Never leak key in output or error message
    if (groqKey && groqKey.length > 5) {
      if (health.error) {
        expect(health.error).not.toContain(groqKey);
      }
    }

    if (!groqKey || groqKey === '' || groqKey === 'your_groq_api_key_here') {
      // If unconfigured in local dev / test run, health check reports clean 400 without crashing
      expect(health.ok).toBe(false);
      expect(health.status).toBe(400);
      expect(health.error).toContain('GROQ_API_KEY');
    } else {
      // If configured with real key, asserts live status code without printing key
      console.log(`[Groq Live Check Result] Status: ${health.status}, Latency: ${health.latencyMs}ms, Model: ${health.model}`);
      expect([200, 401, 429]).toContain(health.status);
    }
  });

  test('5. Inert failover: with GROQ_API_KEY empty and Gemini OK, prove no Groq call is made', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-valid-gemini-key';
    delete process.env.GROQ_API_KEY;

    let groqCallMade = false;
    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('api.groq.com')) {
        groqCallMade = true;
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        category: 'cat-sanitation',
                        priority: 'MEDIUM',
                        reasoning: 'Overflowing garbage bin on street corner.',
                        language: 'en',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting('Garbage dump not cleared', 'Garbage dump', DEFAULT_CATEGORIES);
      expect(result.fallbackTriggered).toBe(false);
      expect(result.provider).toBe('gemini');
      expect(groqCallMade).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('6. With Gemini 403 mocked and no Groq key, result is heuristics plus a clear reason', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-denied-gemini-key';
    delete process.env.GROQ_API_KEY;

    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: { code: 403, message: 'Google project permission denied' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input, init);
    };

    try {
      const result = await classifyComplaintRouting(
        'Water pipeline leaking heavily onto the main junction',
        'Water leak emergency',
        DEFAULT_CATEGORIES,
      );
      expect(result.fallbackTriggered).toBe(true);
      expect(result.provider).toBe('fallback');
      expect(result.category).toBe('cat-water');
      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning).toContain('AI unavailable — fallback used');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
