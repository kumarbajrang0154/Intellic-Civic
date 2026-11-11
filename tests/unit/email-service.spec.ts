import { test, expect } from '@playwright/test';
import {
  escapeHtml,
  hashEmailRecipient,
  renderEmailTemplate,
  sendTemplatedEmail,
} from '@/services/email-service';

test.describe('Email Service — HTML Escaping, Missing Key Handling, HMAC Hashing & Failure Audit', () => {
  test('renderEmailTemplate escapes dangerous HTML and blocks javascript: links across templates', () => {
    const xssPayload = '<script>alert("xss")</script><img src=x onerror=\'steal()\'>';

    const statusEmail = renderEmailTemplate('complaintStatusChanged', {
      ticketId: 'IC-9001',
      title: `Pothole ${xssPayload}`,
      previousStatus: 'ASSIGNED',
      newStatus: 'IN_PROGRESS',
      notes: `Update: ${xssPayload}`,
      complaintUrl: 'javascript:alert(1)',
    });
    expect(statusEmail.html).not.toContain('<script>');
    expect(statusEmail.html).not.toContain('<img ');
    expect(statusEmail.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    expect(statusEmail.html).not.toContain('href="javascript:');
    expect(statusEmail.html).toContain('href="#"');

    const resolvedEmail = renderEmailTemplate('complaintResolved', {
      ticketId: 'IC-9002',
      title: 'Streetlight & Drainage <fix>',
      resolutionNotes: 'Fixed <b>cleanly</b>',
      feedbackUrl: 'https://intellicivic.gov.in/citizen/complaints/123#feedback',
    });
    expect(resolvedEmail.html).toContain('&lt;fix&gt;');
    expect(resolvedEmail.html).toContain('&lt;b&gt;cleanly&lt;&#x2F;b&gt;');
    expect(resolvedEmail.html).toContain('https:&#x2F;&#x2F;intellicivic.gov.in&#x2F;citizen&#x2F;complaints&#x2F;123#feedback');

    const escalatedEmail = renderEmailTemplate('slaEscalated', {
      ticketId: 'IC-9003',
      title: xssPayload,
      priority: 'CRITICAL',
      departmentName: 'Public <Works>',
      deadlineIso: '2026-10-02T00:00:00.000Z',
      complaintUrl: '/dept-head/complaints/123',
    });
    expect(escalatedEmail.html).not.toContain('<script>');
    expect(escalatedEmail.html).toContain('Public &lt;Works&gt;');

    const reopenedEmail = renderEmailTemplate('complaintReopened', {
      ticketId: 'IC-9004',
      title: 'Sewer leak',
      reason: `Still leaking ${xssPayload}`,
      newStatus: 'IN_PROGRESS',
      complaintUrl: '/officer/complaints/123',
    });
    expect(reopenedEmail.html).not.toContain('<img ');
    expect(escapeHtml(xssPayload)).not.toContain('<');
  });

  test('missing RESEND_API_KEY logs a non-PII warning, does not throw, and skips delivery', async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => {
      warnings.push(args.map((a) => String(a)).join(' '));
    };

    const recipient = 'sensitive.citizen@example.com';
    let dbCreateCalled = false;
    const mockDb = {
      emailDelivery: {
        create: async () => {
          dbCreateCalled = true;
          return {};
        },
      },
    };

    try {
      const result = await sendTemplatedEmail(
        'complaintStatusChanged',
        recipient,
        {
          ticketId: 'IC-1234',
          title: 'Broken curb',
          newStatus: 'ASSIGNED',
          complaintUrl: '/citizen/complaints/1',
        },
        {
          env: { EMAIL_HMAC_SECRET: 'email-secret-key' },
          prismaClient: mockDb,
        },
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe('SKIPPED');
      expect(result.skipped).toBe(true);
      expect(result.recipientHash).not.toBe(recipient);
      expect(dbCreateCalled).toBe(false);
      expect(warnings.some((w) => w.includes('RESEND_API_KEY'))).toBe(true);
      for (const w of warnings) {
        expect(w).not.toContain(recipient);
      }
    } finally {
      console.warn = origWarn;
    }
  });

  test('hashEmailRecipient hashes recipient with EMAIL_HMAC_SECRET (distinct from RATE_LIMIT_HMAC_SECRET)', () => {
    const hashA = hashEmailRecipient('Citizen@Example.com', { EMAIL_HMAC_SECRET: 'secret-alpha' });
    const hashANormalized = hashEmailRecipient('citizen@example.com', { EMAIL_HMAC_SECRET: 'secret-alpha' });
    const hashB = hashEmailRecipient('citizen@example.com', { EMAIL_HMAC_SECRET: 'secret-beta' });

    expect(hashA).toBe(hashANormalized);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(hashA).not.toContain('citizen');
    expect(hashA).not.toBe(hashB);
  });

  test('failed send persists EmailDelivery record with FAILED status, hashed recipient, and <=200-char lastError', async () => {
    const records: any[] = [];
    const mockDb = {
      emailDelivery: {
        create: async ({ data }: { data: any }) => {
          records.push(data);
          return { id: 'ed_1', ...data };
        },
      },
    };

    const recipient = 'citizen.person@example.org';
    const longErrorPayload = `Resend gateway error for ${recipient}: ${'X'.repeat(400)}`;
    const mockFetch: typeof fetch = async () =>
      new Response(longErrorPayload, { status: 502, statusText: 'Bad Gateway' });

    const origWarn = console.warn;
    console.warn = () => {};
    try {
      const result = await sendTemplatedEmail(
        'complaintResolved',
        recipient,
        {
          ticketId: 'IC-5555',
          title: 'Drainage cleared',
          feedbackUrl: '/citizen/complaints/5555#feedback',
        },
        {
          env: {
            RESEND_API_KEY: 're_test_mock_key',
            EMAIL_HMAC_SECRET: 'separate-email-hmac-secret',
          },
          fetchImpl: mockFetch,
          prismaClient: mockDb,
        },
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(records).toHaveLength(1);
      expect(records[0].kind).toBe('complaintResolved');
      expect(records[0].status).toBe('FAILED');
      expect(records[0].attempts).toBe(1);
      expect(records[0].recipientHash).toMatch(/^[a-f0-9]{64}$/);
      expect(records[0].recipientHash).not.toContain(recipient);
      expect(records[0].lastError.length).toBeLessThanOrEqual(200);
      expect(records[0].lastError).not.toContain(recipient);
    } finally {
      console.warn = origWarn;
    }
  });
});

