import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import prisma from '@/lib/prisma';

export interface CitizenAuthPayload {
  id: string;
  mobileNumber?: string | null;
  email?: string | null;
  name?: string | null;
  role: 'CITIZEN';
  isProfileComplete?: boolean;
}

type RequireCitizenResult =
  | { authorized: true; user: CitizenAuthPayload }
  | { authorized: false; response: NextResponse };

export async function requireCitizen(): Promise<RequireCitizenResult> {
  const cookieStore = cookies();
  const token = cookieStore.get('ic_access_token')?.value;

  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json({ statusCode: 401, message: 'Authentication required.' }, { status: 401 }),
    };
  }

  const payload = decodeJwtToken(token);
  if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
    return {
      authorized: false,
      response: NextResponse.json({ statusCode: 401, message: 'Session expired. Please sign in again.' }, { status: 401 }),
    };
  }

  const userId = payload.sub;
  const userMobile = payload.mobileNumber;
  const userEmail = payload.email;

  const orConditions: any[] = [];
  if (userId) orConditions.push({ id: userId });
  if (userMobile) orConditions.push({ mobileNumber: userMobile });
  if (userEmail) orConditions.push({ email: userEmail.trim().toLowerCase() });

  if (orConditions.length === 0) {
    return {
      authorized: false,
      response: NextResponse.json({ statusCode: 401, message: 'Invalid token payload.' }, { status: 401 }),
    };
  }

  const dbUser = await prisma.user.findFirst({
    where: { OR: orConditions },
    select: {
      id: true,
      name: true,
      email: true,
      mobileNumber: true,
      role: true,
      isSuspended: true,
      deletedAt: true,
    },
  });

  if (!dbUser) {
    return {
      authorized: false,
      response: NextResponse.json({ statusCode: 401, message: 'User account not found.' }, { status: 401 }),
    };
  }

  if (dbUser.isSuspended || dbUser.deletedAt) {
    const msg = dbUser.isSuspended
      ? 'Your account has been suspended by administration.'
      : 'Your account has been deactivated by administration.';
    return {
      authorized: false,
      response: NextResponse.json(
        { statusCode: 403, message: msg },
        { status: 403 },
      ),
    };
  }

  if (payload.role !== 'CITIZEN' || (dbUser.role && dbUser.role !== 'CITIZEN')) {
    return {
      authorized: false,
      response: NextResponse.json(
        { statusCode: 403, message: 'Forbidden: Citizen role required.' },
        { status: 403 },
      ),
    };
  }

  return {
    authorized: true,
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      mobileNumber: dbUser.mobileNumber,
      role: 'CITIZEN',
    },
  };
}
