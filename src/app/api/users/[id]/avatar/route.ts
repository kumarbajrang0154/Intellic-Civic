import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
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
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
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
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new NextResponse('Avatar not found', { status: 404 });
  } catch (error: any) {
    return new NextResponse('Internal error', { status: 500 });
  }
}
