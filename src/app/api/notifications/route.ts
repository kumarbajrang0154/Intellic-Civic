import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import {
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-store';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaff();
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await listUserNotifications(auth.user.id, { unreadOnly, limit });
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
    const auth = await requireStaff();
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      const count = await markAllNotificationsRead(auth.user.id);
      return NextResponse.json({ success: true, updatedCount: count });
    }

    if (!notificationId) {
      return NextResponse.json({ message: 'notificationId is required' }, { status: 400 });
    }

    const success = await markNotificationRead(notificationId, auth.user.id);
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
