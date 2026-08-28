'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface ComplaintItem {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string } | null;
  assignment?: {
    departmentOfficer?: { id: string; name: string; email: string };
  } | null;
}

export default function DepartmentQueuePage() {
  const router = useRouter();

  const [user, setUser] = React.useState<{ name: string; role: 'DEPARTMENT_HEAD'; departmentId?: string }>({
    name: 'Department Head',
    role: 'DEPARTMENT_HEAD',
  });

  const [complaints, setComplaints] = React.useState<ComplaintItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = React.useState('');
  const [priorityFilter, setPriorityFilter] = React.useState('');
  const [assignmentFilter, setAssignmentFilter] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Pagination
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  const fetchQueue = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let queryUrl = `/api/complaints?page=${page}&limit=15`;
      if (statusFilter) queryUrl += `&status=${statusFilter}`;
      if (priorityFilter) queryUrl += `&priority=${priorityFilter}`;

      const res = await fetch(queryUrl);
      if (!res.ok) {
        throw new Error('Failed to load department queue');
      }

      const responseData = await res.json();
      const rawData: ComplaintItem[] = responseData.data || [];
      const meta = responseData.meta || { totalPages: 1, total: 0 };

      setComplaints(rawData);
      setTotalPages(meta.totalPages || 1);
      setTotalCount(meta.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter]);

  React.useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Client-side search and officer assignment filter
  const filteredQueue = React.useMemo(() => {
    return complaints.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesTicket = item.ticketId.toLowerCase().includes(q);
        if (!matchesTitle && !matchesTicket) return false;
      }

      // Assignment Filter
      if (assignmentFilter === 'ASSIGNED') {
        if (!item.assignment?.departmentOfficer) return false;
      } else if (assignmentFilter === 'UNASSIGNED') {
        if (item.assignment?.departmentOfficer) return false;
      }

      return true;
    });
  }, [complaints, searchQuery, assignmentFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'AI_PROCESSING':
        return <Badge variant="info">Submitted</Badge>;
      case 'PENDING_DEPT_REVIEW':
        return <Badge variant="secondary">Under Review</Badge>;
      case 'ASSIGNED':
        return <Badge variant="outline">Assigned</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning">In Progress</Badge>;
      case 'RESOLVED':
      case 'CLOSED':
        return <Badge variant="success">Resolved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'DUPLICATE':
        return <Badge variant="secondary">Duplicate</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge variant="destructive">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge variant="warning">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge variant="secondary">MEDIUM</Badge>;
      case 'LOW':
        return <Badge variant="outline">LOW</Badge>;
      default:
        return <span className="text-xs text-muted-foreground">-</span>;
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Department Complaints Queue
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dense staff queue for reviewing complaints, monitoring status transitions, and assigning officers.
            </p>
          </div>
          <Badge variant="outline" className="text-xs self-start sm:self-auto font-mono">
            Total Tickets: {totalCount}
          </Badge>
        </div>

        {/* Filter Controls Bar */}
        <Card className="shadow-sm">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ticket ID or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PENDING_DEPT_REVIEW">Pending Review</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </Select>

            {/* Priority Filter */}
            <Select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>

            {/* Officer Assignment Filter */}
            <Select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
              className="text-xs"
            >
              <option value="">All Assignments</option>
              <option value="ASSIGNED">Officer Assigned</option>
              <option value="UNASSIGNED">Unassigned</option>
            </Select>
          </CardContent>
        </Card>

        {/* Table View */}
        <Card className="shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Skeleton key={n} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-xs text-destructive">{error}</div>
            ) : filteredQueue.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                No complaints found matching current filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned Officer</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueue.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/60"
                      onClick={() => router.push(`/department-head/complaints/${item.id}`)}
                    >
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {item.ticketId}
                      </TableCell>
                      <TableCell className="font-medium text-foreground max-w-xs truncate">
                        {item.title}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.category?.name || 'General'}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                      <TableCell className="text-xs">
                        {item.assignment?.departmentOfficer ? (
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                            <UserCheck className="h-3.5 w-3.5" />
                            {item.assignment.departmentOfficer.name}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground italic">
                            <UserX className="h-3.5 w-3.5" />
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
