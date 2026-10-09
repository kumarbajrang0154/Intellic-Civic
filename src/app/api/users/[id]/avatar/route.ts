import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decodeJwtToken } from '@/lib/auth-jwt';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = req.cookies.get('ic_access_token')?.value;
    if (!token) {
      return new NextResponse('Unauthorized: Valid session required', { status: 401 });
    }
    const payload = decodeJwtToken(token);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      return new NextResponse('Unauthorized: Session expired or invalid', { status: 401 });
    }

    const userId = params.id;
    if (!userId) {
      return new NextResponse('User ID required', { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });

    if (!user || !user.avatarUrl) {
      return new NextResponse('Avatar not found', { status: 404 });
    }

    const { avatarUrl } = user;

    // Handle data URIs by decoding and streaming the binary image
    if (avatarUrl.startsWith('data:')) {
      const match = avatarUrl.match(/^data:([^;,]+)(?:;charset=[^;,]+)?(?:;(base64))?,([\s\S]*)$/);
      if (match) {
        const mimeType = match[1] || 'image/jpeg';
        const isBase64 = match[2] === 'base64';
        const rawData = match[3];
        const buffer = isBase64
          ? Buffer.from(rawData, 'base64')
          : Buffer.from(decodeURIComponent(rawData), 'utf8');

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'private, max-age=86400',
          },
        });
      }
      return new NextResponse('Invalid data URI format', { status: 400 });
    }

    // If it's an external http(s) URL, redirect to it
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return NextResponse.redirect(avatarUrl, {
        status: 302,
        headers: {
          'Cache-Control': 'private, max-age=86400',
        },
      });
    }

    return new NextResponse('Avatar not found', { status: 404 });
  } catch (error: any) {
    return new NextResponse('Internal error', { status: 500 });
  }
}
