import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createJwtToken, decodeJwtToken } from '@/lib/auth-jwt';
import { requireCitizen } from '@/lib/citizen-auth';
import { getOrCreateCitizenProfile, updateCitizenProfile } from '@/lib/user-store';

export async function GET() {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const profile = await getOrCreateCitizenProfile(auth.user.id);
    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const identifier = auth.user.id;

    const body = await request.json();
    const { name, email, address, avatarUrl } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ statusCode: 400, message: 'Full name is required' }, { status: 400 });
    }

    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json({ statusCode: 400, message: 'Valid Gmail / Email address is required' }, { status: 400 });
    }

    if (!address || !address.trim()) {
      return NextResponse.json({ statusCode: 400, message: 'Residential address is required' }, { status: 400 });
    }

    const updatedProfile = await updateCitizenProfile(identifier, {
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
      avatarUrl: avatarUrl || '',
    });

    // Update JWT token with new name
    const newPayload = {
      sub: auth.user.id,
      mobileNumber: auth.user.mobileNumber,
      role: 'CITIZEN',
      name: updatedProfile.name,
      email: updatedProfile.email,
      isProfileComplete: updatedProfile.isProfileComplete,
    };

    const newAccessToken = await createJwtToken(newPayload, '7d');
    const isProduction = process.env.NODE_ENV === 'production';

    const response = NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedProfile,
    });

    response.cookies.set('ic_access_token', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    if (error?.code === 'P2002' || error?.message?.includes('P2002') || error?.message?.includes('Unique constraint failed')) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 409,
          message: 'This email is already associated with another account. Please use a different email.',
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
