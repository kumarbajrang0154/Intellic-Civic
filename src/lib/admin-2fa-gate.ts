import { createJwtToken } from '@/lib/auth-jwt';
import prisma from '@/lib/prisma';
import {
  isAdminTwoFactorEligibleRole,
  isMissingTwoFactorSchemaError,
} from '@/services/totp-service';

export const TWO_FACTOR_CHALLENGE_COOKIE = 'ic_2fa_challenge';
export const TWO_FACTOR_CHALLENGE_MAX_AGE_SEC = 300;

export async function issueTwoFactorChallengeIfRequired(
  userId: string,
  role?: string | null,
): Promise<string | null> {
  if (!isAdminTwoFactorEligibleRole(role)) {
    return null;
  }

  let enabled = false;
  try {
    const record = await prisma.adminTwoFactor.findUnique({
      where: { userId },
      select: { enabled: true },
    });
    enabled = Boolean(record?.enabled);
  } catch (err: unknown) {
    if (isMissingTwoFactorSchemaError(err)) {
      return null;
    }
    throw err;
  }

  if (!enabled) {
    return null;
  }

  return createJwtToken(
    {
      sub: userId,
      role,
      type: '2fa_challenge',
    },
    '5m',
  );
}

