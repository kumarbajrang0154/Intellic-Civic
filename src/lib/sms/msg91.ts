import type { SmsProvider, SmsSendResult } from '@/lib/sms/provider';

export const MSG91_SEND_OTP_ENDPOINT = 'https://control.msg91.com/api/v5/otp';

export interface Msg91Config {
  authKey: string;
  templateId: string;
  senderId: string;
}

export interface Msg91Env {
  MSG91_AUTH_KEY?: string;
  MSG91_TEMPLATE_ID?: string;
  MSG91_SENDER_ID?: string;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export function readMsg91Config(env: Msg91Env | NodeJS.ProcessEnv = process.env): Msg91Config {
  return {
    authKey: (env.MSG91_AUTH_KEY || '').trim(),
    templateId: (env.MSG91_TEMPLATE_ID || '').trim(),
    senderId: (env.MSG91_SENDER_ID || '').trim(),
  };
}

export function formatMsg91Mobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export class Msg91SmsProvider implements SmsProvider {
  private readonly config: Msg91Config;
  private readonly fetchFn?: FetchLike;

  constructor(config?: Partial<Msg91Config>, fetchFn?: FetchLike) {
    const envConfig = readMsg91Config();
    this.config = {
      authKey: (config?.authKey ?? envConfig.authKey).trim(),
      templateId: (config?.templateId ?? envConfig.templateId).trim(),
      senderId: (config?.senderId ?? envConfig.senderId).trim(),
    };
    this.fetchFn = fetchFn;
  }

  /** Dispatches an OTP via MSG91 v5 API without logging OTP or phone PII. */
  async send(phone: string, otp: string): Promise<SmsSendResult> {
    if (!this.config.authKey || !this.config.templateId || !this.config.senderId) {
      console.error('[SMS:MSG91] Missing required MSG91 configuration');
      return { ok: false };
    }

    const mobile = formatMsg91Mobile(phone);
    if (!mobile) {
      console.error('[SMS:MSG91] Invalid mobile number format');
      return { ok: false };
    }

    const url = new URL(MSG91_SEND_OTP_ENDPOINT);
    url.searchParams.set('template_id', this.config.templateId);
    url.searchParams.set('mobile', mobile);
    url.searchParams.set('otp', otp);
    url.searchParams.set('otp_length', '6');
    url.searchParams.set('otp_expiry', '15');
    url.searchParams.set('sender', this.config.senderId);

    const fetchImpl: FetchLike = this.fetchFn ?? globalThis.fetch;

    try {
      const response = await fetchImpl(url.toString(), {
        method: 'POST',
        headers: {
          authkey: this.config.authKey,
          'content-type': 'application/json',
        },
        body: '{}',
      });

      if (!response.ok) {
        console.error('[SMS:MSG91] Delivery failed with HTTP status:', response.status);
        return { ok: false };
      }

      let data: { type?: string; message?: string; request_id?: string } | null = null;
      try {
        data = await response.json();
      } catch {
        return { ok: true };
      }

      if (data?.type && data.type.toLowerCase() === 'error') {
        console.error('[SMS:MSG91] Provider returned error response');
        return { ok: false };
      }

      const providerRef =
        typeof data?.request_id === 'string' && data.request_id.trim()
          ? data.request_id.trim()
          : typeof data?.message === 'string' && data.message.trim()
            ? data.message.trim()
            : undefined;

      return { ok: true, ...(providerRef ? { providerRef } : {}) };
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      console.error('[SMS:MSG91] Request failed:', errorName);
      return { ok: false };
    }
  }
}
