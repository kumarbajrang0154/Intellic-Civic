import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { z } from 'zod';

export const TOTP_ISSUER = 'IntelliCivic';
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DRIFT_WINDOW = 1;
export const RECOVERY_CODE_COUNT = 8;
export const RECOVERY_BCRYPT_ROUNDS = 10;
export const ADMIN_2FA_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const DEV_FALLBACK_CIPHER_KEY = 'intellicivic-dev-only-totp-key-do-not-use-in-prod';

let hasWarnedMissingKey = false;

export const totpVerifyTokenSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter a valid 6-digit authenticator code.'),
});

export const totpChallengeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(6, 'Verification code is required.')
      .max(32, 'Verification code is too long.'),
    useRecoveryCode: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.useRecoveryCode && !/^\d{6}$/.test(data.code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['code'],
        message: 'Enter a valid 6-digit authenticator code.',
      });
    }
    if (data.useRecoveryCode) {
      const normalized = normalizeRecoveryCode(data.code);
      if (!/^[A-Z0-9]{8,16}$/.test(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['code'],
          message: 'Enter a valid recovery code (e.g. ABCD-EFGH-23).',
        });
      }
    }
  });

export function isAdminTwoFactorEligibleRole(role?: string | null): boolean {
  return Boolean(role && (ADMIN_2FA_ROLES as readonly string[]).includes(role));
}

export function isMissingTwoFactorSchemaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return code === 'P2021' || code === 'P2022';
}

function resolveEncryptionKey(explicitKey?: string): Buffer {
  const rawKey =
    explicitKey ??
    process.env.TOTP_ENCRYPTION_KEY ??
    process.env.JWT_SECRET ??
    '';

  if (rawKey.trim().length > 0) {
    return crypto.createHash('sha256').update(rawKey, 'utf8').digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('TOTP encryption key is missing in production environment.');
  }

  if (!hasWarnedMissingKey) {
    hasWarnedMissingKey = true;
    console.warn('[SECURITY] TOTP_ENCRYPTION_KEY not set; using development fallback cipher key.');
  }

  return crypto.createHash('sha256').update(DEV_FALLBACK_CIPHER_KEY, 'utf8').digest();
}

export function encryptTotpSecret(secretBase32: string, explicitKey?: string): string {
  const key = resolveEncryptionKey(explicitKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptTotpSecret(payload: string, explicitKey?: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unsupported encrypted TOTP secret format.');
  }

  const [, ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');

  if (iv.length !== 12 || authTag.length !== 16 || encrypted.length === 0) {
    throw new Error('Malformed encrypted TOTP secret payload.');
  }

  const key = resolveEncryptionKey(explicitKey);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function buildTotpInstance(secretBase32: string, accountLabel: string = 'admin'): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: accountLabel,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function generateTotpCode(
  secretBase32: string,
  options?: { timestampMs?: number; accountLabel?: string },
): string {
  const totp = buildTotpInstance(secretBase32, options?.accountLabel);
  return totp.generate({ timestamp: options?.timestampMs });
}

export function verifyTotpCode(
  secretBase32: string,
  code: string,
  options?: { timestampMs?: number; window?: number; accountLabel?: string },
): boolean {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const totp = buildTotpInstance(secretBase32, options?.accountLabel);
  const delta = totp.validate({
    token: normalized,
    window: options?.window ?? TOTP_DRIFT_WINDOW,
    timestamp: options?.timestampMs,
  });

  return delta !== null;
}

export interface TotpSetupPayload {
  secretBase32: string;
  encryptedSecret: string;
  otpauthUri: string;
  qrDataUrl: string;
}

export async function generateTotpSetup(
  accountLabel: string,
  options?: { secretBase32?: string; encryptionKey?: string },
): Promise<TotpSetupPayload> {
  const secretBase32 =
    options?.secretBase32 ?? new OTPAuth.Secret({ size: 20 }).base32;
  const totp = buildTotpInstance(secretBase32, accountLabel);
  const otpauthUri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, {
    width: 220,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  const encryptedSecret = encryptTotpSecret(secretBase32, options?.encryptionKey);

  return {
    secretBase32,
    encryptedSecret,
    otpauthUri,
    qrDataUrl,
  };
}

export function normalizeRecoveryCode(rawCode: string): string {
  return rawCode.replace(/[\s-]+/g, '').toUpperCase();
}

function generateSingleRecoveryCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < 10; i++) {
    chars.push(RECOVERY_ALPHABET[crypto.randomInt(0, RECOVERY_ALPHABET.length)]);
  }
  const raw = chars.join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
}

export async function generateRecoveryCodes(
  count: number = RECOVERY_CODE_COUNT,
  bcryptRounds: number = RECOVERY_BCRYPT_ROUNDS,
): Promise<{ codes: string[]; hashes: string[] }> {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = generateSingleRecoveryCode();
    const hash = await bcrypt.hash(normalizeRecoveryCode(code), bcryptRounds);
    codes.push(code);
    hashes.push(hash);
  }

  return { codes, hashes };
}

export async function consumeRecoveryCode(
  candidateCode: string,
  storedHashes: readonly string[],
): Promise<{ valid: boolean; remainingHashes: string[] }> {
  const normalized = normalizeRecoveryCode(candidateCode);
  if (!normalized || storedHashes.length === 0) {
    return { valid: false, remainingHashes: [...storedHashes] };
  }

  let matchedIndex = -1;
  for (let i = 0; i < storedHashes.length; i++) {
    const isMatch = await bcrypt.compare(normalized, storedHashes[i]);
    if (isMatch && matchedIndex === -1) {
      matchedIndex = i;
    }
  }

  if (matchedIndex === -1) {
    return { valid: false, remainingHashes: [...storedHashes] };
  }

  return {
    valid: true,
    remainingHashes: storedHashes.filter((_, index) => index !== matchedIndex),
  };
}

