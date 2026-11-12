import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCitizen } from '@/lib/citizen-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  pushSubscriptionSchema,
  removeCitizenPushSubscription,
  saveCitizenPushSubscription,
} from '@/services/multichannel-notification-service';

export const dynamic = 'force-dynamic';

const deletePushSchema = z.object({
  endpoint: z.string().url().max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = pushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid push subscription payload.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    try {
      const result = await saveCitizenPushSubscription(auth.user.id, parsed.data);
      return NextResponse.json(result, {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch (dbErr: any) {
      if (dbErr?.code === 'P2021') {
        return NextResponse.json(
          { statusCode: 503, message: 'Push subscriptions table migration pending.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      throw dbErr;
    }
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/citizen/push-subscribe' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to register push subscription.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = deletePushSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { statusCode: 400, message: 'Valid push endpoint URL is required.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = await removeCitizenPushSubscription(auth.user.id, parsed.data.endpoint);
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: unknown) {
    captureException(error, { route: 'DELETE /api/citizen/push-subscribe' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to remove push subscription.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

