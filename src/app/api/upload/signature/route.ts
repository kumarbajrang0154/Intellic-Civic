import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { verifyJwtToken } from '@/lib/auth-jwt';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { statusCode: 401, message: 'Unauthorized session' },
        { status: 401 },
      );
    }

    const payload = await verifyJwtToken(accessToken);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      return NextResponse.json(
        { statusCode: 401, message: 'Unauthorized: Session invalid or expired' },
        { status: 401 },
      );
    }

    const rateLimitResult = await checkRateLimit(request, 'upload', payload.sub);
    if (!rateLimitResult.success) {
      return rateLimitErrorResponse(rateLimitResult);
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo';
    const apiKey = process.env.CLOUDINARY_API_KEY || '1234567890';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'sample_secret';

    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp },
      apiSecret,
    );

    return NextResponse.json({
      timestamp,
      signature,
      cloudName,
      apiKey,
    });
  } catch (error: any) {
    console.error('[Upload Signature Error]', error);
    return NextResponse.json(
      {
        statusCode: 500,
        message: 'Failed to generate upload signature',
        ...(process.env.NODE_ENV !== 'production' ? { error: error?.message } : {}),
      },
      { status: 500 },
    );
  }
}

