'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Filter,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Info,
  Calendar,
  MapPin,
  Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AssignedComplaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  category?: { name: string };
  location?: { address?: string };
}

export default function OfficerComplaintsPage() {
  const router = useRouter();

  const [user, setUser] = React.useState<{
    name: string;
    role: 'DEPARTMENT_OFFICER';
    departmentId?: string;
  }>({
    name: 'Department Officer',
    role: 'DEPARTMENT_OFFICER',
  });

  const [complaints, setComplaints] = React.useState<AssignedComplaint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('ALL');

  const fetchAssignedComplaints = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          setUser({
            name: meData.user.name || 'Department Officer',
            role: 'DEPARTMENT_OFFICER',
            departmentId: meData.user.departmentId,
          });
        }
      }

      let url = '/api/complaints?assignedToMe=true&limit=100';
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      if (priorityFilter !== 'ALL') {
        url += `&priority=${priorityFilter}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load assigned complaints list');
      }

      const data = await res.json();
      setComplaints(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading complaints');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  React.useEffect(() => {
    fetchAssignedComplaints();
  }, [fetchAssignedComplaints]);

  // Client-side search filtering
  const filteredComplaints = React.useMemo(() => {
    return complaints.filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.ticketId.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.category?.name || '').toLowerCase().includes(q) ||
        (c.location?.address || '').toLowerCase().includes(q)
      );
    });
  }, [complaints, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return <Badge variant="warning">Assigned (Action Required)</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">In Progress</Badge>;
      case 'RESOLVED':
        return <Badge variant="success">Resolved</Badge>;
      case 'CLOSED':
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge variant="destructive">Critical</Badge>;
      case 'HIGH':
        return <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-700">High</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">Medium</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-1">
            <FileText className="h-4 w-4" />
            <span>My Assigned Complaints</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Assigned Workload Queue
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Complaints directly assigned to you for investigation, field resolution, and status updates.
          </p>
        </div>

        {/* Informational Banner on Self-Assignment */}
        <Alert className="border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-xs font-bold">Workload Scoping Note</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            This queue surfaces complaints where your Department Head has explicitly assigned you as the handling officer. (Self-claiming unclaimed department complaints is a planned feature requiring Department Head permission delegation).
          </AlertDescription>
        </Alert>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-lg border shadow-sm">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search ticket ID, title, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </Select>

            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Complaints Table/Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <Card key={n} className="p-4 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </div>
        ) : filteredComplaints.length === 0 ? (
          <Card className="border-dashed py-12 text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
              <CardTitle className="text-base">No Assigned Complaints Found</CardTitle>
              <CardDescription className="text-xs max-w-sm">
                {searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                  ? 'No assigned complaints matched your selected filters.'
                  : 'You currently have zero active complaints assigned to you.'}
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredComplaints.map((item) => (
              <Card
                key={item.id}
                className="hover:border-primary/40 transition-colors shadow-sm"
              >
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-primary">
                        {item.ticketId}
                      </span>
                      {getStatusBadge(item.status)}
                      {getPriorityBadge(item.priority)}
                      <Badge variant="outline" className="text-xs">
                        {item.category?.name || 'General Issue'}
                      </Badge>
                    </div>

                    <h3 className="font-semibold text-base text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap pt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.location?.address || 'Location provided'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Assigned {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <Link href={`/officer/complaints/${item.id}`}>
                      <Button size="sm" className="text-xs flex items-center gap-1.5">
                        <span>Work Detail</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
