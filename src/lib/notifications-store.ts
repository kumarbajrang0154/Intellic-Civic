import prisma from '@/lib/prisma';
import { NotificationType } from '@prisma/client';

export interface NotificationItem {
  id: string;
  complaintId: string;
  recipientUserId: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
  complaint?: {
    ticketId: string;
    title: string;
    status: string;
    priority: string | null;
  };
}

function formatNotification(n: any): NotificationItem {
  return {
    id: n.id,
    complaintId: n.complaintId,
    recipientUserId: n.recipientUserId,
    type: n.type,
    message: n.message,
    isRead: Boolean(n.isRead),
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : new Date(n.createdAt).toISOString(),
    complaint: n.complaint
      ? {
          ticketId: n.complaint.ticketId,
          title: n.complaint.title,
          status: n.complaint.status,
          priority: n.complaint.priority ?? null,
        }
      : undefined,
  };
}

export async function listUserNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number },
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const where: any = { recipientUserId: userId };
  if (options?.unreadOnly) {
    where.isRead = false;
  }

  const [unreadCount, rawNotifications] = await Promise.all([
    prisma.notification.count({ where: { recipientUserId: userId, isRead: false } }),
    prisma.notification.findMany({
      where,
      include: {
        complaint: {
          select: {
            ticketId: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
    }),
  ]);

  return {
    items: rawNotifications.map(formatNotification),
    unreadCount,
  };
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    const updated = await prisma.notification.updateMany({
      where: { id: notificationId, recipientUserId: userId },
      data: { isRead: true },
    });
    return updated.count > 0;
  } catch {
    return false;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  try {
    const updated = await prisma.notification.updateMany({
      where: { recipientUserId: userId, isRead: false },
      data: { isRead: true },
    });
    return updated.count;
  } catch {
    return 0;
  }
}

export async function createNotification(data: {
  complaintId: string;
  recipientUserId: string;
  type: NotificationType;
  message: string;
}): Promise<NotificationItem> {
  const created = await prisma.notification.create({
    data: {
      complaintId: data.complaintId,
      recipientUserId: data.recipientUserId,
      type: data.type,
      message: data.message,
    },
    include: {
      complaint: {
        select: {
          ticketId: true,
          title: true,
          status: true,
          priority: true,
        },
      },
    },
  });
  return formatNotification(created);
}
