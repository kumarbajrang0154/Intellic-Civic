'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, FileText, Loader2, ArrowRight } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface NotificationItem {
  id: string;
  complaintId: string;
  recipientUserId: string;
  type: string;
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

export default function CitizenNotificationsPage() {
  const [user, setUser] = React.useState<{ name: string; role: 'CITIZEN' }>({
    name: 'Citizen',
    role: 'CITIZEN',
  });

  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [markingAll, setMarkingAll] = React.useState(false);

  React.useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser({ name: data.user.name || 'Citizen', role: 'CITIZEN' });
          }
        }
      } catch (err) {}
    }
    loadUser();
  }, []);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('[NOTIFICATIONS FETCH ERROR]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        toast.success('Notification marked as read');
      }
    } catch (err) {
      toast.error('Failed to update notification');
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (err) {
      toast.error('Failed to mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
              {unreadCount > 0 && (
                <Badge className="bg-ic-action text-white text-xs px-2 py-0.5 font-bold">
                  {unreadCount} Unread
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time updates on your submitted complaints and municipal status changes.
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="text-xs gap-1.5 self-start sm:self-auto"
            >
              {markingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 text-ic-action" />
              )}
              <span>Mark All as Read</span>
            </Button>
          )}
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-ic-action" />
            <span>Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <Card className="border border-dashed shadow-none">
            <CardContent className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Bell className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">No notifications yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  You will receive real-time notifications here when your submitted complaints are reviewed, assigned, or resolved.
                </p>
              </div>
              <div className="pt-2">
                <Link href="/citizen">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>View My Complaints</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <Card
                key={n.id}
                className={`transition-colors border shadow-xs ${
                  !n.isRead ? 'bg-blue-50/40 border-blue-200/60' : 'bg-white border-slate-200'
                }`}
              >
                <CardContent className="p-4 sm:p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        !n.isRead ? 'bg-ic-action text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Bell className="h-4 w-4" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-ic-action shrink-0" title="Unread" />
                        )}
                        {n.complaint?.ticketId && (
                          <span className="font-mono text-xs font-bold text-ic-action">
                            #{n.complaint.ticketId}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                        {n.message}
                      </p>

                      {n.complaintId && (
                        <div className="pt-1">
                          <Link
                            href={`/citizen/complaints/${n.complaintId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-ic-action hover:underline"
                          >
                            <span>View Complaint Details</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(n.id)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 shrink-0"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
