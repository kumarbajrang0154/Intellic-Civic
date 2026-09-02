import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createJwtToken, decodeJwtToken } from '@/lib/auth-jwt';
import { getOrCreateCitizenProfile, updateCitizenProfile } from '@/lib/user-store';

export async function GET() {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload || !payload.mobileNumber) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getOrCreateCitizenProfile(payload.mobileNumber);
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
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload || !payload.mobileNumber) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

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

    const updatedProfile = await updateCitizenProfile(payload.mobileNumber, {
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
      avatarUrl: avatarUrl || '',
    });

    // Update JWT token with new name
    const newPayload = {
      ...payload,
      name: updatedProfile.name,
      email: updatedProfile.email,
      isProfileComplete: updatedProfile.isProfileComplete,
    };

    const newAccessToken = await createJwtToken(newPayload, '7d');
    const isProduction = process.env.NODE_ENV === 'production';

    cookieStore.set('ic_access_token', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedProfile,
    });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
