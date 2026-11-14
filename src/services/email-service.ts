import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { scrubPiiStrings } from '@/lib/sentry-scrubber';

export type EmailTemplateName =
  | 'complaintStatusChanged'
  | 'slaEscalated'
  | 'complaintReopened'
  | 'complaintResolved';

export interface EmailTemplateDataMap {
  complaintStatusChanged: {
    ticketId: string;
    title: string;
    previousStatus?: string | null;
    newStatus: string;
    notes?: string | null;
    complaintUrl: string;
  };
  slaEscalated: {
    ticketId: string;
    title: string;
    priority: string;
    departmentName?: string | null;
    deadlineIso: string;
    complaintUrl: string;
  };
  complaintReopened: {
    ticketId: string;
    title: string;
    reason: string;
    newStatus: string;
    complaintUrl: string;
  };
  complaintResolved: {
    ticketId: string;
    title: string;
    resolutionNotes?: string | null;
    feedbackUrl: string;
  };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailDeliveryStore {
  emailDelivery: {
    create: (args: {
      data: {
        kind: string;
        recipientHash: string;
        status: string;
        attempts: number;
        lastError?: string | null;
      };
    }) => Promise<any>;
  };
}

export interface SendEmailOptions {
  fetchImpl?: typeof fetch;
  prismaClient?: EmailDeliveryStore;
  env?: Record<string, string | undefined>;
}

export interface SendEmailResult {
  ok: boolean;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  skipped?: boolean;
  recipientHash: string;
  error?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM_ADDRESS = 'IntelliCivic <notifications@intellicivic.gov.in>';
const MAX_ERROR_LENGTH = 200;

export function escapeHtml(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

function sanitizeHref(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  ) {
    return escapeHtml(trimmed);
  }
  return '#';
}

export function buildAppUrl(path: string, env: Record<string, string | undefined> = process.env): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = (env.NEXT_PUBLIC_FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (base && (base.startsWith('https://') || base.startsWith('http://')) && !base.includes('your-domain')) {
    return `${base}${normalizedPath}`;
  }
  return normalizedPath;
}

export function hashEmailRecipient(
  email: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const rawSecret = env.EMAIL_RECIPIENT_HMAC_SECRET?.trim() || env.EMAIL_HMAC_SECRET?.trim();
  const isProduction = env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';

  let secret = rawSecret;
  if (!secret) {
    if (isProduction) {
      console.warn('[EmailService] EMAIL_RECIPIENT_HMAC_SECRET (EMAIL_HMAC_SECRET) is not set in production; using fallback key derivation.');
    }
    const fallbackSeed = env.RATE_LIMIT_HMAC_SECRET?.trim() || env.JWT_SECRET?.trim() || 'dev-email-recipient-hmac-secret-not-real';
    secret = `email-hash:${fallbackSeed}`;
  }

  // Never fall back to an unkeyed hash. Always compute HMAC-SHA256 keyed with secret.
  return crypto
    .createHmac('sha256', secret)
    .update(email.trim().toLowerCase())
    .digest('hex');
}

function formatStatusLabel(status?: string | null): string {
  if (!status) return 'Updated';
  return status.replace(/_/g, ' ');
}

function wrapEmailLayout(heading: string, bodyHtml: string): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<body style="margin:0;padding:24px;background-color:#F2EFE6;font-family:Arial,Helvetica,sans-serif;color:#131E20;">',
    '<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E2D9;border-radius:16px;padding:24px;">',
    '<div style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:#3468A1;text-transform:uppercase;margin-bottom:8px;">IntelliCivic Municipal Platform</div>',
    `<h1 style="font-size:20px;line-height:28px;margin:0 0 16px 0;color:#131E20;">${escapeHtml(heading)}</h1>`,
    bodyHtml,
    '<hr style="border:none;border-top:1px solid #E5E2D9;margin:24px 0 12px 0;" />',
    '<p style="font-size:12px;line-height:18px;color:#6E6B64;margin:0;">This is an automated civic service notification from IntelliCivic.</p>',
    '</div>',
    '</body>',
    '</html>',
  ].join('');
}

export function renderEmailTemplate<T extends EmailTemplateName>(
  template: T,
  data: EmailTemplateDataMap[T],
): RenderedEmail {
  switch (template) {
    case 'complaintStatusChanged': {
      const d = data as EmailTemplateDataMap['complaintStatusChanged'];
      const safeTicket = escapeHtml(d.ticketId);
      const safeTitle = escapeHtml(d.title);
      const safeNewStatus = escapeHtml(formatStatusLabel(d.newStatus));
      const safePrevStatus = d.previousStatus ? escapeHtml(formatStatusLabel(d.previousStatus)) : null;
      const safeNotes = d.notes ? escapeHtml(d.notes) : null;
      const safeUrl = sanitizeHref(d.complaintUrl);

      const subject = `[IntelliCivic #${d.ticketId}] Status updated to ${formatStatusLabel(d.newStatus)}`;
      const bodyHtml = [
        `<p style="font-size:14px;line-height:22px;margin:0 0 12px 0;">Complaint <strong>#${safeTicket}</strong> (${safeTitle}) has a new status update.</p>`,
        `<p style="font-size:14px;line-height:22px;margin:0 0 12px 0;">${safePrevStatus ? `Previous status: <strong>${safePrevStatus}</strong> &rarr; ` : ''}Current status: <strong>${safeNewStatus}</strong></p>`,
        safeNotes
          ? `<div style="background:#F2EFE6;border-radius:8px;padding:12px;font-size:13px;line-height:20px;margin:0 0 16px 0;"><strong>Notes:</strong> ${safeNotes}</div>`
          : '',
        `<p style="margin:16px 0 0 0;"><a href="${safeUrl}" style="display:inline-block;background:#3468A1;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;">View Complaint</a></p>`,
      ].join('');

      const text = [
        `Complaint #${d.ticketId} (${d.title}) status updated to ${formatStatusLabel(d.newStatus)}.`,
        d.notes ? `Notes: ${d.notes}` : '',
        `View complaint: ${d.complaintUrl}`,
      ]
        .filter(Boolean)
        .join('\n');

      return {
        subject,
        html: wrapEmailLayout('Complaint Status Updated', bodyHtml),
        text,
      };
    }

    case 'slaEscalated': {
      const d = data as EmailTemplateDataMap['slaEscalated'];
      const safeTicket = escapeHtml(d.ticketId);
      const safeTitle = escapeHtml(d.title);
      const safePriority = escapeHtml(d.priority);
      const safeDept = d.departmentName ? escapeHtml(d.departmentName) : 'Unassigned Department';
      const safeDeadline = escapeHtml(d.deadlineIso);
      const safeUrl = sanitizeHref(d.complaintUrl);

      const subject = `[SLA Escalation] Complaint #${d.ticketId} breached ${d.priority} SLA`;
      const bodyHtml = [
        `<p style="font-size:14px;line-height:22px;margin:0 0 12px 0;">Complaint <strong>#${safeTicket}</strong> (${safeTitle}) has exceeded its SLA resolution deadline.</p>`,
        `<ul style="font-size:13px;line-height:22px;padding-left:18px;margin:0 0 16px 0;">`,
        `<li><strong>Priority:</strong> ${safePriority}</li>`,
        `<li><strong>Department:</strong> ${safeDept}</li>`,
        `<li><strong>SLA Deadline:</strong> ${safeDeadline}</li>`,
        `</ul>`,
        `<p style="margin:16px 0 0 0;"><a href="${safeUrl}" style="display:inline-block;background:#D98E2B;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;">Review Escalated Ticket</a></p>`,
      ].join('');

      const text = [
        `SLA Escalation: Complaint #${d.ticketId} (${d.title}) exceeded its ${d.priority} SLA deadline (${d.deadlineIso}).`,
        `Department: ${d.departmentName || 'Unassigned'}`,
        `Review: ${d.complaintUrl}`,
      ].join('\n');

      return {
        subject,
        html: wrapEmailLayout('SLA Deadline Breached — Escalation Notice', bodyHtml),
        text,
      };
    }

    case 'complaintReopened': {
      const d = data as EmailTemplateDataMap['complaintReopened'];
      const safeTicket = escapeHtml(d.ticketId);
      const safeTitle = escapeHtml(d.title);
      const safeReason = escapeHtml(d.reason);
      const safeStatus = escapeHtml(formatStatusLabel(d.newStatus));
      const safeUrl = sanitizeHref(d.complaintUrl);

      const subject = `[IntelliCivic #${d.ticketId}] Complaint Reopened by Citizen`;
      const bodyHtml = [
        `<p style="font-size:14px;line-height:22px;margin:0 0 12px 0;">Complaint <strong>#${safeTicket}</strong> (${safeTitle}) has been reopened by the citizen and moved to <strong>${safeStatus}</strong>.</p>`,
        `<div style="background:#F2EFE6;border-radius:8px;padding:12px;font-size:13px;line-height:20px;margin:0 0 16px 0;"><strong>Citizen Reason:</strong> ${safeReason}</div>`,
        `<p style="margin:16px 0 0 0;"><a href="${safeUrl}" style="display:inline-block;background:#3468A1;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;">Inspect Reopened Complaint</a></p>`,
      ].join('');

      const text = [
        `Complaint #${d.ticketId} (${d.title}) was reopened and is now ${formatStatusLabel(d.newStatus)}.`,
        `Reason: ${d.reason}`,
        `Inspect: ${d.complaintUrl}`,
      ].join('\n');

      return {
        subject,
        html: wrapEmailLayout('Complaint Reopened', bodyHtml),
        text,
      };
    }

    case 'complaintResolved': {
      const d = data as EmailTemplateDataMap['complaintResolved'];
      const safeTicket = escapeHtml(d.ticketId);
      const safeTitle = escapeHtml(d.title);
      const safeNotes = d.resolutionNotes ? escapeHtml(d.resolutionNotes) : null;
      const safeUrl = sanitizeHref(d.feedbackUrl);

      const subject = `[IntelliCivic #${d.ticketId}] Complaint Resolved — Share Your Feedback`;
      const bodyHtml = [
        `<p style="font-size:14px;line-height:22px;margin:0 0 12px 0;">Your complaint <strong>#${safeTicket}</strong> (${safeTitle}) has been marked as <strong>Resolved</strong>.</p>`,
        safeNotes
          ? `<div style="background:#F2EFE6;border-radius:8px;padding:12px;font-size:13px;line-height:20px;margin:0 0 16px 0;"><strong>Resolution Notes:</strong> ${safeNotes}</div>`
          : '',
        `<p style="font-size:13px;line-height:20px;color:#6E6B64;margin:0 0 16px 0;">Please review the resolution, rate your experience, or reopen the ticket within 7 days if the issue persists.</p>`,
        `<p style="margin:16px 0 0 0;"><a href="${safeUrl}" style="display:inline-block;background:#3B8F68;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;">Rate Resolution &amp; Give Feedback</a></p>`,
      ].join('');

      const text = [
        `Your complaint #${d.ticketId} (${d.title}) has been marked as Resolved.`,
        d.resolutionNotes ? `Resolution Notes: ${d.resolutionNotes}` : '',
        `Rate resolution or provide feedback: ${d.feedbackUrl}`,
      ]
        .filter(Boolean)
        .join('\n');

      return {
        subject,
        html: wrapEmailLayout('Complaint Resolved', bodyHtml),
        text,
      };
    }
  }
}

function truncateError(rawError: unknown): string {
  const msg = rawError instanceof Error ? rawError.message : String(rawError || 'Unknown email delivery error');
  return scrubPiiStrings(msg).slice(0, MAX_ERROR_LENGTH);
}

async function recordEmailDelivery(
  db: EmailDeliveryStore,
  entry: {
    kind: EmailTemplateName;
    recipientHash: string;
    status: 'SENT' | 'FAILED';
    attempts: number;
    lastError?: string | null;
  },
): Promise<void> {
  try {
    await db.emailDelivery.create({
      data: {
        kind: entry.kind,
        recipientHash: entry.recipientHash,
        status: entry.status,
        attempts: entry.attempts,
        lastError: entry.lastError ? entry.lastError.slice(0, MAX_ERROR_LENGTH) : null,
      },
    });
  } catch (err) {
    console.warn('[EmailService] Failed to persist EmailDelivery record (non-fatal).');
  }
}

/**
 * Sends a templated notification email via Resend HTTP API.
 * Never throws; missing API key logs a non-PII warning and skips cleanly.
 * Failures are persisted to EmailDelivery with a hashed recipient and truncated error.
 */
export async function sendTemplatedEmail<T extends EmailTemplateName>(
  template: T,
  toEmail: string,
  data: EmailTemplateDataMap[T],
  options: SendEmailOptions = {},
): Promise<SendEmailResult> {
  const env = options.env || process.env;
  const db = options.prismaClient || (prisma as unknown as EmailDeliveryStore);
  const fetchImpl = options.fetchImpl || fetch;
  const isProduction = env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
  const hmacSecret = env.EMAIL_RECIPIENT_HMAC_SECRET?.trim() || env.EMAIL_HMAC_SECRET?.trim();
  if (isProduction && !hmacSecret) {
    console.warn(`[EmailService] EMAIL_RECIPIENT_HMAC_SECRET not configured in production; skipping "${template}" email delivery.`);
    return { ok: false, skipped: true, status: 'SKIPPED', recipientHash: '' };
  }

  const trimmedRecipient = (toEmail || '').trim();
  const recipientHash = hashEmailRecipient(trimmedRecipient || 'invalid', env);

  if (!trimmedRecipient || !trimmedRecipient.includes('@')) {
    console.warn(`[EmailService] Missing or invalid recipient for template "${template}"; skipping.`);
    return { ok: false, skipped: true, status: 'SKIPPED', recipientHash };
  }

  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_resend_api_key_here') {
    console.warn(`[EmailService] RESEND_API_KEY not configured; skipping "${template}" email.`);
    return { ok: false, skipped: true, status: 'SKIPPED', recipientHash };
  }

  const fromAddress = env.EMAIL_FROM?.trim() || DEFAULT_FROM_ADDRESS;
  const rendered = renderEmailTemplate(template, data);

  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [trimmedRecipient],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      const lastError = truncateError(`HTTP ${response.status}: ${responseText || response.statusText}`);
      console.warn(`[EmailService] Delivery failed for "${template}" (HTTP ${response.status}).`);
      await recordEmailDelivery(db, {
        kind: template,
        recipientHash,
        status: 'FAILED',
        attempts: 1,
        lastError,
      });
      return { ok: false, status: 'FAILED', recipientHash, error: lastError };
    }

    await recordEmailDelivery(db, {
      kind: template,
      recipientHash,
      status: 'SENT',
      attempts: 1,
      lastError: null,
    });
    return { ok: true, status: 'SENT', recipientHash };
  } catch (err) {
    const lastError = truncateError(err);
    console.warn(`[EmailService] Network error sending "${template}" email.`);
    await recordEmailDelivery(db, {
      kind: template,
      recipientHash,
      status: 'FAILED',
      attempts: 1,
      lastError,
    });
    return { ok: false, status: 'FAILED', recipientHash, error: lastError };
  }
}

