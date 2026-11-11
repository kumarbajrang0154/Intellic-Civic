import { test, expect } from '@playwright/test';
import {
  consumeRecoveryCode,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpCode,
  generateTotpSetup,
  isAdminTwoFactorEligibleRole,
  totpChallengeSchema,
  totpVerifyTokenSchema,
  verifyTotpCode,
} from '../../src/services/totp-service';

const SAMPLE_KEY = 'test-totp-cipher-key-2026-intellicivic';

test.describe('Admin 2FA TOTP & Recovery Codes Service', () => {
  test('generates local PNG DataURL QR and otpauth URI without external services', async () => {
    const setup = await generateTotpSetup('admin@smartcity.gov.in', {
      secretBase32: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      encryptionKey: SAMPLE_KEY,
    });

    expect(setup.secretBase32).toBe('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    expect(setup.otpauthUri).toContain('otpauth://totp/IntelliCivic:admin%40smartcity.gov.in');
    expect(setup.otpauthUri).toContain('issuer=IntelliCivic');
    expect(setup.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(decryptTotpSecret(setup.encryptedSecret, SAMPLE_KEY)).toBe(setup.secretBase32);
  });

  test('verifies RFC 6238 6-digit TOTP with +-1 step drift and rejects expired or invalid codes', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const fixedNow = Date.UTC(2026, 10, 12, 10, 0, 15); // +15s into 30s slot
    const currentCode = generateTotpCode(secret, { timestampMs: fixedNow });
    const prevSlotCode = generateTotpCode(secret, { timestampMs: fixedNow - 30_000 });
    const expiredSlotCode = generateTotpCode(secret, { timestampMs: fixedNow - 90_000 });

    expect(currentCode).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, currentCode, { timestampMs: fixedNow })).toBe(true);
    expect(verifyTotpCode(secret, prevSlotCode, { timestampMs: fixedNow })).toBe(true);
    expect(verifyTotpCode(secret, expiredSlotCode, { timestampMs: fixedNow })).toBe(false);
    expect(verifyTotpCode(secret, '00000a', { timestampMs: fixedNow })).toBe(false);
    expect(verifyTotpCode(secret, '12345', { timestampMs: fixedNow })).toBe(false);
  });

  test('encrypts and decrypts TOTP secrets via AES-256-GCM and detects tampering or wrong keys', () => {
    const plaintext = 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU';
    const encrypted = encryptTotpSecret(plaintext, SAMPLE_KEY);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted).not.toContain(plaintext);

    expect(decryptTotpSecret(encrypted, SAMPLE_KEY)).toBe(plaintext);

    // Wrong key must fail GCM authentication
    expect(() => decryptTotpSecret(encrypted, 'different-wrong-key')).toThrow();

    // Tampered ciphertext must fail GCM authentication
    const parts = encrypted.split(':');
    const flipped = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3].slice(0, -2)}00`;
    expect(() => decryptTotpSecret(flipped, SAMPLE_KEY)).toThrow();
  });

  test('hashes backup recovery codes with bcryptjs and enforces single-use consumption', async () => {
    const { codes, hashes } = await generateRecoveryCodes(8, 4);

    expect(codes).toHaveLength(8);
    expect(hashes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) {
      expect(c).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{2}$/);
    }

    // Consume third recovery code cleanly (case & whitespace tolerant)
    const targetCode = codes[2];
    const normalizedInput = `  ${targetCode.toLowerCase().replace(/-/g, ' ')}  `;
    const firstUse = await consumeRecoveryCode(normalizedInput, hashes);

    expect(firstUse.valid).toBe(true);
    expect(firstUse.remainingHashes).toHaveLength(7);

    // Reusing same code against updated hash list MUST fail
    const secondUse = await consumeRecoveryCode(targetCode, firstUse.remainingHashes);
    expect(secondUse.valid).toBe(false);
    expect(secondUse.remainingHashes).toHaveLength(7);

    // Arbitrary invalid code rejected
    const wrongUse = await consumeRecoveryCode('ZZZZ-ZZZZ-ZZ', hashes);
    expect(wrongUse.valid).toBe(false);
  });

  test('validates schemas and restricts 2FA eligibility to ADMIN and SUPER_ADMIN', () => {
    expect(totpVerifyTokenSchema.safeParse({ code: '654321' }).success).toBe(true);
    expect(totpVerifyTokenSchema.safeParse({ code: '12ab56' }).success).toBe(false);

    expect(
      totpChallengeSchema.safeParse({ code: 'AB3D-EF4G-23', useRecoveryCode: true }).success,
    ).toBe(true);
    expect(
      totpChallengeSchema.safeParse({ code: 'bad', useRecoveryCode: true }).success,
    ).toBe(false);

    expect(isAdminTwoFactorEligibleRole('SUPER_ADMIN')).toBe(true);
    expect(isAdminTwoFactorEligibleRole('ADMIN')).toBe(true);
    expect(isAdminTwoFactorEligibleRole('DEPARTMENT_HEAD')).toBe(false);
    expect(isAdminTwoFactorEligibleRole('CITIZEN')).toBe(false);
  });
});

