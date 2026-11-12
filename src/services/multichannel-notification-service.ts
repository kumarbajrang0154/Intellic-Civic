import crypto from 'node:crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { captureMessage } from '@/lib/error-monitoring';
import { formatMsg91Mobile } from '@/lib/sms/msg91';

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(8).max(500),
    auth: z.string().min(4).max(200),
  }),
  userAgent: z.string().max(255).optional(),
});

export type NotificationChannel = 'WHATSAPP' | 'SMS' | 'PUSH';
export type DeliveryStatus = 'SENT' | 'FAILED' | 'SKIPPED';

export interface MultiChannelDispatchResult {
  channel: NotificationChannel;
  status: DeliveryStatus;
  providerRef?: string;
  reason?: string;
}

export interface MultiChannelNotificationDb {
  user: {
    findUnique: (args: any) => Promise<{ id: string; mobileNumber: string | null } | null>;
  };
  pushSubscription: {
    upsert: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<Array<{ id: string; endpoint: string }>>;
  };
  notificationDeliveryLog: {
    create: (args: any) => Promise<any>;
  };
}

export function hashNotificationTarget(target: string): string {
  const secret =
    process.env.EMAIL_HMAC_SECRET ||
    process.env.RATE_LIMIT_HMAC_SECRET ||
    'intellicivic-dev-notif-hmac';
  return crypto.createHmac('sha256', secret).update(target.trim()).digest('hex');
}

export function maskPhoneForLog(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function sendWhatsAppMessage(
  mobileNumber: string,
  textBody: string,
  fetchFn: FetchLike = globalThis.fetch,
): Promise<MultiChannelDispatchResult> {
  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!phoneId || !accessToken) {
    return { channel: 'WHATSAPP', status: 'SKIPPED', reason: 'WhatsApp credentials unconfigured' };
  }

  const to = formatMsg91Mobile(mobileNumber);
  if (!to) {
    return { channel: 'WHATSAPP', status: 'SKIPPED', reason: 'Invalid mobile number' };
  }

  try {
    const res = await fetchFn(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: textBody.slice(0, 1000) },
      }),
    });
    if (!res.ok) {
      return { channel: 'WHATSAPP', status: 'FAILED', reason: `HTTP ${res.status}` };
    }
    const data = (await res.json().catch(() => null)) as { messages?: Array<{ id?: string }> } | null;
    return {
      channel: 'WHATSAPP',
      status: 'SENT',
      providerRef: data?.messages?.[0]?.id?.slice(0, 120),
    };
  } catch (err: any) {
    return {
      channel: 'WHATSAPP',
      status: 'FAILED',
      reason: (err?.message || 'WhatsApp request error').slice(0, 180),
    };
  }
}

export async function sendTransactionalSmsNotification(
  mobileNumber: string,
  message: string,
  fetchFn: FetchLike = globalThis.fetch,
): Promise<MultiChannelDispatchResult> {
  const authKey = (process.env.MSG91_AUTH_KEY || '').trim();
  const flowId = (process.env.MSG91_NOTIFY_FLOW_ID || '').trim();
  if (!authKey || !flowId) {
    return { channel: 'SMS', status: 'SKIPPED', reason: 'SMS notification flow unconfigured' };
  }

  const to = formatMsg91Mobile(mobileNumber);
  if (!to) {
    return { channel: 'SMS', status: 'SKIPPED', reason: 'Invalid mobile number' };
  }

  try {
    const res = await fetchFn('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        authkey: authKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        template_id: flowId,
        short_url: '0',
        recipients: [{ mobiles: to, message: message.slice(0, 160) }],
      }),
    });
    if (!res.ok) {
      return { channel: 'SMS', status: 'FAILED', reason: `HTTP ${res.status}` };
    }
    const data = (await res.json().catch(() => null)) as { request_id?: string } | null;
    return {
      channel: 'SMS',
      status: 'SENT',
      providerRef: data?.request_id?.slice(0, 120),
    };
  } catch (err: any) {
    return {
      channel: 'SMS',
      status: 'FAILED',
      reason: (err?.message || 'SMS request error').slice(0, 180),
    };
  }
}

export async function saveCitizenPushSubscription(
  userId: string,
  input: z.infer<typeof pushSubscriptionSchema>,
  db: MultiChannelNotificationDb = prisma as unknown as MultiChannelNotificationDb,
): Promise<{ ok: true; subscriptionCount: number }> {
  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent?.slice(0, 255) || null,
      isActive: true,
    },
    update: {
      userId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent?.slice(0, 255) || null,
      isActive: true,
    },
  });

  const active = await db.pushSubscription.findMany({
    where: { userId, isActive: true },
    select: { id: true, endpoint: true },
  });

  return { ok: true, subscriptionCount: active.length };
}

export async function removeCitizenPushSubscription(
  userId: string,
  endpoint: string,
  db: MultiChannelNotificationDb = prisma as unknown as MultiChannelNotificationDb,
): Promise<{ ok: true; deactivated: number }> {
  const result = await db.pushSubscription.updateMany({
    where: { userId, endpoint },
    data: { isActive: false },
  });
  return { ok: true, deactivated: Number(result?.count ?? 0) };
}

export async function dispatchCitizenMultiChannelNotification(
  params: {
    userId: string;
    complaintId?: string;
    ticketId: string;
    message: string;
    channels?: NotificationChannel[];
  },
  options?: {
    db?: MultiChannelNotificationDb;
    fetchFn?: FetchLike;
  },
): Promise<{ results: MultiChannelDispatchResult[] }> {
  const db = options?.db ?? (prisma as unknown as MultiChannelNotificationDb);
  const fetchFn = options?.fetchFn ?? globalThis.fetch;
  const channels: NotificationChannel[] = params.channels ?? ['WHATSAPP', 'SMS', 'PUSH'];

  const user = await db.user
    .findUnique({
      where: { id: params.userId },
      select: { id: true, mobileNumber: true },
    })
    .catch(() => null);

  const results: MultiChannelDispatchResult[] = [];
  const recipientHash = hashNotificationTarget(user?.mobileNumber || params.userId);

  if (channels.includes('WHATSAPP')) {
    const waRes = user?.mobileNumber
      ? await sendWhatsAppMessage(user.mobileNumber, `[${params.ticketId}] ${params.message}`, fetchFn)
      : { channel: 'WHATSAPP' as const, status: 'SKIPPED' as const, reason: 'No mobile number' };
    results.push(waRes);
  }

  if (channels.includes('SMS')) {
    const smsRes = user?.mobileNumber
      ? await sendTransactionalSmsNotification(
          user.mobileNumber,
          `${params.ticketId}: ${params.message}`,
          fetchFn,
        )
      : { channel: 'SMS' as const, status: 'SKIPPED' as const, reason: 'No mobile number' };
    results.push(smsRes);
  }

  if (channels.includes('PUSH')) {
    let subs: Array<{ id: string; endpoint: string }> = [];
    try {
      subs = await db.pushSubscription.findMany({
        where: { userId: params.userId, isActive: true },
        select: { id: true, endpoint: true },
      });
    } catch {
      subs = [];
    }

    const pushRelayUrl = (process.env.WEB_PUSH_RELAY_URL || '').trim();
    if (subs.length === 0) {
      results.push({ channel: 'PUSH', status: 'SKIPPED', reason: 'No active push subscription' });
    } else if (!pushRelayUrl) {
      results.push({
        channel: 'PUSH',
        status: 'SKIPPED',
        reason: `${subs.length} subscription(s) stored; WEB_PUSH_RELAY_URL unconfigured`,
      });
    } else {
      try {
        const res = await fetchFn(pushRelayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoints: subs.map((s) => s.endpoint),
            title: `IntelliCivic Update (${params.ticketId})`,
            body: params.message.slice(0, 240),
          }),
        });
        results.push({
          channel: 'PUSH',
          status: res.ok ? 'SENT' : 'FAILED',
          reason: res.ok ? undefined : `HTTP ${res.status}`,
        });
      } catch (err: any) {
        results.push({
          channel: 'PUSH',
          status: 'FAILED',
          reason: (err?.message || 'Push dispatch failed').slice(0, 180),
        });
      }
    }
  }

  // Persist non-PII delivery logs best-effort (never fail caller on un-migrated table)
  for (const r of results) {
    await db.notificationDeliveryLog
      .create({
        data: {
          complaintId: params.complaintId || null,
          recipientHash,
          channel: r.channel,
          status: r.status,
          providerRef: r.providerRef || null,
          lastError: r.reason ? r.reason.slice(0, 200) : null,
        },
      })
      .catch(() => {});

    if (r.status === 'FAILED') {
      captureMessage(
        `Multi-channel notification failed (${r.channel}): ${r.reason || 'unknown'}`,
        'warning',
        { service: 'multichannel-notifications', channel: r.channel },
      );
    }
  }

  return { results };
}

