import * as fs from 'node:fs';
import * as path from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { test, expect } from '@playwright/test';
import { handleCitizenChatbotPost } from '@/lib/citizen-chatbot-http';
import {
  answerCitizenQuestion,
  buildCitizenComplaintContext,
  CITIZEN_COMPLAINT_SELECT,
  CitizenChatbotValidationError,
  ruleBasedAnswer,
  type CitizenChatbotDbClient,
  type CitizenSafeComplaint,
} from '@/services/citizen-chatbot-service';

function makeMockDb(
  rows: Array<{
    citizenIdOwner?: string;
    ticketId: string;
    title: string;
    status: string;
    priority: string | null;
    category?: { name: string } | null;
    department?: { name: string } | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date | null;
  }>,
  capturedQueries?: Array<Record<string, unknown>>,
): CitizenChatbotDbClient {
  return {
    complaint: {
      async findMany(args) {
        if (capturedQueries) {
          capturedQueries.push(args as unknown as Record<string, unknown>);
        }
        return rows.filter(
          (r) => !r.citizenIdOwner || r.citizenIdOwner === args.where.citizenId,
        );
      },
    },
  };
}

test.describe('Citizen Chatbot Service, Route Validation & Safe Rendering', () => {
  const sampleComplaints: CitizenSafeComplaint[] = [
    {
      ticketId: 'INC-20261110-0042',
      title: 'Broken streetlight near Ward 4',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      categoryName: 'Electricity & Streetlights',
      departmentName: 'Street Lighting',
      createdAt: '2026-11-10',
      updatedAt: '2026-11-11',
      resolvedAt: null,
    },
    {
      ticketId: 'INC-20261101-0007',
      title: 'Water pipeline leak',
      status: 'RESOLVED',
      priority: 'MEDIUM',
      categoryName: 'Water Supply',
      departmentName: 'Water Supply',
      createdAt: '2026-11-01',
      updatedAt: '2026-11-03',
      resolvedAt: '2026-11-03',
    },
  ];

  test('ruleBasedAnswer matches owned ticketId, summarizes otherwise, and excludes other citizens', () => {
    const ticketReply = ruleBasedAnswer(
      'What happened to inc-20261110-0042?',
      sampleComplaints,
    );
    expect(ticketReply).toContain('INC-20261110-0042');
    expect(ticketReply).toContain('IN_PROGRESS');
    expect(ticketReply).toContain('Street Lighting');

    const unownedTicketReply = ruleBasedAnswer(
      'Check INC-20261112-9999 please',
      sampleComplaints,
    );
    expect(unownedTicketReply).toContain('No complaint with ticket ID INC-20261112-9999');
    expect(unownedTicketReply).not.toContain('other-citizen');

    const summaryReply = ruleBasedAnswer('What is the status of my complaints?', sampleComplaints);
    expect(summaryReply).toContain('2 recent complaint(s)');
    expect(summaryReply).toContain('IN_PROGRESS: 1');
    expect(summaryReply).toContain('RESOLVED: 1');
    expect(summaryReply).toContain('INC-20261110-0042');
  });

  test('buildCitizenComplaintContext filters strictly by citizenId and omits PII, coords, and notes', async () => {
    const queries: Array<Record<string, unknown>> = [];
    const db = makeMockDb(
      [
        {
          citizenIdOwner: 'citizen-a',
          ticketId: 'INC-20261110-0042',
          title: 'Own pothole report',
          status: 'ASSIGNED',
          priority: 'MEDIUM',
          category: { name: 'Roads' },
          department: { name: 'Roads & Bridges' },
          createdAt: new Date('2026-11-10T08:00:00.000Z'),
          updatedAt: new Date('2026-11-11T09:00:00.000Z'),
          resolvedAt: null,
        },
        {
          citizenIdOwner: 'citizen-b',
          ticketId: 'INC-20261111-8888',
          title: 'Other citizen private report',
          status: 'SUBMITTED',
          priority: 'HIGH',
          category: { name: 'Water' },
          department: { name: 'Water Supply' },
          createdAt: new Date('2026-11-11T10:00:00.000Z'),
          updatedAt: new Date('2026-11-11T10:00:00.000Z'),
          resolvedAt: null,
        },
      ],
      queries,
    );

    const ctx = await buildCitizenComplaintContext('citizen-a', db);
    expect(queries).toHaveLength(1);
    expect(queries[0].where).toEqual({ citizenId: 'citizen-a' });
    expect(ctx.complaints).toHaveLength(1);
    expect(ctx.complaints[0].ticketId).toBe('INC-20261110-0042');
    expect(ctx.summaryText).not.toContain('INC-20261111-8888');

    const selectKeys = Object.keys(CITIZEN_COMPLAINT_SELECT);
    expect(selectKeys).not.toContain('citizenId');
    expect(selectKeys).not.toContain('location');
    expect(selectKeys).not.toContain('phone');
    expect(selectKeys).not.toContain('mobile');
    expect(selectKeys).not.toContain('email');
    expect(selectKeys).not.toContain('internalNotes');
  });

  test('answerCitizenQuestion falls back to rules on Gemini error/empty and enforces 500 char cap', async () => {
    const db = makeMockDb([
      {
        citizenIdOwner: 'citizen-a',
        ticketId: 'INC-20261110-0042',
        title: 'Broken streetlight',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        category: { name: 'Electricity' },
        department: { name: 'Street Lighting' },
        createdAt: new Date('2026-11-10T08:00:00.000Z'),
        updatedAt: new Date('2026-11-11T09:00:00.000Z'),
        resolvedAt: null,
      },
    ]);

    const failedGemini = await answerCitizenQuestion(
      'citizen-a',
      'Status of INC-20261110-0042?',
      {
        db,
        generateReply: async () => {
          throw new Error('Gemini 503 unavailable');
        },
      },
    );
    expect(failedGemini.source).toBe('rules');
    expect(failedGemini.answer).toContain('INC-20261110-0042');

    const emptyGemini = await answerCitizenQuestion(
      'citizen-a',
      'What is the status of my complaints?',
      {
        db,
        generateReply: async () => '   ',
      },
    );
    expect(emptyGemini.source).toBe('rules');
    expect(emptyGemini.answer).toContain('IN_PROGRESS: 1');

    const overLong = 'a'.repeat(501);
    const rejected = await answerCitizenQuestion('citizen-a', overLong, {
      db,
      generateReply: async () => 'Should not run',
    }).catch((err: unknown) => err);
    expect(rejected).toBeInstanceOf(CitizenChatbotValidationError);
    expect((rejected as CitizenChatbotValidationError).status).toBe(400);
  });

  test('route handler rejects empty chat message with HTTP 400', async () => {
    const req = new NextRequest('http://localhost/api/citizen/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    });

    const res = await handleCitizenChatbotPost(req, {
      requireCitizenFn: async () => ({
        authorized: true,
        user: {
          id: 'citizen-1',
          name: 'Test Citizen',
          email: null,
          mobileNumber: '9999999999',
          role: 'CITIZEN',
          isProfileComplete: true,
        },
      }),
      checkRateLimitFn: async () => ({
        success: true,
        limit: 20,
        remaining: 19,
        reset: Date.now() + 60000,
        retryAfterSeconds: 0,
      }),
      answerQuestionFn: async () => ({
        answer: 'unreachable',
        source: 'rules',
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  test('rendered assistant bubble contains no <script> HTML tags when answer includes <script>', () => {
    const panelSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'citizen', 'citizen-chat-panel.tsx'),
      'utf8',
    );
    expect(panelSource).toContain('{message.text}');
    expect(panelSource).not.toContain('dangerouslySetInnerHTML');
    expect(panelSource).not.toContain('innerHTML');

    const maliciousText = '<script>alert("xss")</script> Safe status update';
    const html = renderToStaticMarkup(
      React.createElement(
        'p',
        { className: 'whitespace-pre-wrap break-words leading-relaxed' },
        maliciousText,
      ),
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).toContain('Safe status update');
  });
});
