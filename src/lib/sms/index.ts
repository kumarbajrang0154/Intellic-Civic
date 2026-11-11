import { isProductionOtpEnv, type OtpEnv } from '@/lib/otp-store';
import { Msg91SmsProvider, readMsg91Config, type FetchLike } from '@/lib/sms/msg91';
import type { SmsProvider } from '@/lib/sms/provider';

export type { SmsProvider, SmsSendResult } from '@/lib/sms/provider';
export { Msg91SmsProvider } from '@/lib/sms/msg91';

export type SmsEnv = OtpEnv & {
  MSG91_AUTH_KEY?: string;
  MSG91_TEMPLATE_ID?: string;
  MSG91_SENDER_ID?: string;
};

export interface GetSmsProviderOptions {
  env?: SmsEnv;
  fetchFn?: FetchLike;
}

/**
 * Returns the configured SMS OTP provider.
 * Throws a non-PII configuration error in production if required env vars are missing.
 */
export function getSmsProvider(options: GetSmsProviderOptions = {}): SmsProvider {
  const env = options.env ?? (process.env as SmsEnv);
  const config = readMsg91Config(env);
  const missingConfig = !config.authKey || !config.templateId || !config.senderId;

  if (missingConfig && isProductionOtpEnv(env)) {
    throw new Error('SMS provider configuration missing in production environment');
  }

  return new Msg91SmsProvider(config, options.fetchFn);
}

