import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { getUserByEmail } from '@/lib/staff-dept-store';
import { getOrCreateCitizenProfile } from '@/lib/user-store';

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
        const profile = await getOrCreateCitizenProfile(identifier);
        return NextResponse.json({
          user: {
            id: profile.id,
            mobileNumber: profile.mobileNumber,
            name: profile.name || `Citizen (${profile.mobileNumber ? '+91 ' + profile.mobileNumber : profile.email || 'User'})`,
            email: profile.email || null,
            address: profile.address || null,
            avatarUrl: profile.avatarUrl || null,
            role: 'CITIZEN',
            isProfileComplete: profile.isProfileComplete,
          },
        });
      }
    }

    // Check DB for staff/admin info
    const userId = payload.sub;
    const userEmail = payload.email;

    const staffUser = await (await import('@/lib/prisma')).default.user.findFirst({
      where: {
        OR: [
          ...(userId ? [{ id: userId }] : []),
          ...(userEmail ? [{ email: { equals: userEmail.trim(), mode: 'insensitive' as const } }] : []),
        ],
      },
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
          avatarUrl: staffUser.avatarUrl ?? null,
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
