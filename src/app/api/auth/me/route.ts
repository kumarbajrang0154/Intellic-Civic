import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { getOrCreateCitizenProfile } from '@/lib/user-store';

function formatAvatarUrl(userId: string, rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('data:')) {
    return `/api/users/${userId}/avatar`;
  }
  if (trimmed.startsWith('/api/users/')) {
    return trimmed;
  }
  return null;
}

export async function GET() {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    if (payload.role === 'CITIZEN') {
      const identifier = payload.sub || payload.mobileNumber || payload.email;
      if (identifier) {
        const prismaClient = (await import('@/lib/prisma')).default;
        const dbUser = await prismaClient.user.findFirst({
          where: {
            OR: [
              { id: identifier },
              ...(payload.sub ? [{ id: payload.sub }] : []),
              ...(payload.mobileNumber ? [{ mobileNumber: payload.mobileNumber }] : []),
            ],
          },
          select: {
            id: true,
            isSuspended: true,
            deletedAt: true,
          },
        });

        if (dbUser && (dbUser.isSuspended || dbUser.deletedAt)) {
          return NextResponse.json(
            { user: null, message: 'Your account has been deactivated by administration.' },
            { status: 403 },
          );
        }

        const profile = await getOrCreateCitizenProfile(identifier);
        return NextResponse.json({
          user: {
            id: profile.id,
            mobileNumber: profile.mobileNumber,
            name: profile.name || `Citizen (${profile.mobileNumber ? '+91 ' + profile.mobileNumber : profile.email || 'User'})`,
            email: profile.email || null,
            address: profile.address || null,
            avatarUrl: formatAvatarUrl(profile.id, profile.avatarUrl),
            role: 'CITIZEN',
            isProfileComplete: profile.isProfileComplete,
          },
        });
      }
    }

    // Check DB for user info strictly by sub (userId)
    const userId = payload.sub;
    if (!userId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const prismaClient = (await import('@/lib/prisma')).default;
    const staffUser = await prismaClient.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        departmentId: true,
        municipalityId: true,
        isAuthorized: true,
        isSuspended: true,
      },
    });

    if (!staffUser) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    if (staffUser) {
      return NextResponse.json({
        user: {
          id: staffUser.id,
          email: staffUser.email,
          name: staffUser.name,
          role: staffUser.role,
          departmentId: staffUser.departmentId,
          municipalityId: staffUser.municipalityId,
          isAuthorized: staffUser.isAuthorized,
          isSuspended: staffUser.isSuspended,
          avatarUrl: formatAvatarUrl(staffUser.id, staffUser.avatarUrl),
        },
      });
    }

    return NextResponse.json({
      user: {
        id: payload.sub,
        mobileNumber: payload.mobileNumber || null,
        email: payload.email || null,
        name: payload.name || 'User',
        role: payload.role || 'CITIZEN',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
