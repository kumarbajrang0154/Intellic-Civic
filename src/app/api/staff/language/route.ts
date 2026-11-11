import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';

export const staffLanguageSchema = z.object({
  preferredLanguage: z.enum(['en', 'original']),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    if (!auth.authorized) return auth.response;

    const cookieLang = request.cookies.get('ic_staff_lang')?.value;
    let preferredLanguage: 'en' | 'original' =
      cookieLang === 'original' ? 'original' : 'en';

    try {
      const user = await prisma.user.findUnique({
        where: { id: auth.user.id },
        select: { preferredLanguage: true },
      });
      if (user?.preferredLanguage === 'original' || user?.preferredLanguage === 'en') {
        preferredLanguage = user.preferredLanguage;
      }
    } catch {
      // Fallback gracefully to cookie preference if un-applied migration has not run
    }

    return NextResponse.json({ success: true, preferredLanguage });
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/staff/language' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to load language preference.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireStaff();
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = staffLanguageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid preferredLanguage value.',
        },
        { status: 400 },
      );
    }

    const { preferredLanguage } = parsed.data;

    try {
      await prisma.user.update({
        where: { id: auth.user.id },
        data: { preferredLanguage },
      });
    } catch (dbErr: unknown) {
      const code = (dbErr as { code?: string })?.code;
      // If un-applied migration hasn't added column yet, still persist cleanly in cookie
      if (code !== 'P2022') {
        throw dbErr;
      }
    }

    const response = NextResponse.json({
      success: true,
      preferredLanguage,
    });
    response.cookies.set('ic_staff_lang', preferredLanguage, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    });
    return response;
  } catch (error: unknown) {
    captureException(error, { route: 'PATCH /api/staff/language' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to save language preference.' },
      { status: 500 },
    );
  }
}

