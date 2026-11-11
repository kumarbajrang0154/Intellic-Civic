export interface SmsSendResult {
  ok: boolean;
  providerRef?: string;
}

export interface SmsProvider {
  send(phone: string, otp: string): Promise<SmsSendResult>;
}

