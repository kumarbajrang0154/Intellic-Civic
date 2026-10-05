import { SignJWT } from 'jose';

const isProduction =
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const rawJwtSecret = process.env.JWT_SECRET;

if (isProduction && !rawJwtSecret) {
  throw new Error('JWT_SECRET environment variable is required in production');
}

const JWT_SECRET_KEY = new TextEncoder().encode(
  rawJwtSecret || 'intellicivic-super-secret-jwt-key-2026',
);

export async function createJwtToken(payload: Record<string, any>, expiresIn = '7d'): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET_KEY);
}

export function decodeJwtToken(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    if (typeof Buffer !== 'undefined') {
      return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
    }
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
