import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
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
      if (staffUser.avatarUrl && staffUser.avatarUrl.startsWith('data:') && staffUser.avatarUrl.length > 100 * 1024) {
        console.warn(`[api/auth/me] Base64 avatar payload size: ${(staffUser.avatarUrl.length / 1024).toFixed(2)} KB for user ${staffUser.id}`);
      }

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
