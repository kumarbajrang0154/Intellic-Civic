import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import {
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      return NextResponse.json({ message: 'Session expired' }, { status: 401 });
    }

    const userId = payload.sub;
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await listUserNotifications(userId, { unreadOnly, limit });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch notifications', error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      return NextResponse.json({ message: 'Session expired' }, { status: 401 });
    }

    const userId = payload.sub;
    const body = await req.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      const count = await markAllNotificationsRead(userId);
      return NextResponse.json({ success: true, updatedCount: count });
    }

    if (!notificationId) {
      return NextResponse.json({ message: 'notificationId is required' }, { status: 400 });
    }

    const success = await markNotificationRead(notificationId, userId);
    if (!success) {
      return NextResponse.json({ message: 'Notification not found or already read' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to update notification', error: error.message },
      { status: 500 },
    );
  }
}
