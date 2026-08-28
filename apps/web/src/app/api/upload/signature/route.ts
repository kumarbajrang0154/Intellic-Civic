import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export async function POST() {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { statusCode: 401, message: 'Unauthorized session' },
        { status: 401 },
      );
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
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to generate upload signature', error: error.message },
      { status: 500 },
    );
  }
}
