'use client';

import * as React from 'react';
import { Users, Mail, Phone, ShieldCheck, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface Officer {
  id: string;
  name: string;
  email?: string;
  role: string;
  createdAt: string;
}

interface FieldWorker {
  id: string;
  name: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
}

interface DepartmentInfo {
  id: string;
  name: string;
  description?: string;
}

export default function DepartmentTeamRosterPage() {
  const [user, setUser] = React.useState<{ name: string; role: 'DEPARTMENT_HEAD'; departmentId?: string }>({
    name: 'Department Head',
    role: 'DEPARTMENT_HEAD',
  });

  const [department, setDepartment] = React.useState<DepartmentInfo | null>(null);
  const [officers, setOfficers] = React.useState<Officer[]>([]);
  const [fieldWorkers, setFieldWorkers] = React.useState<FieldWorker[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchRoster() {
      setLoading(true);
      setError(null);

      try {
        const meRes = await fetch('/api/auth/me');
        let deptId = '';
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.user) {
            deptId = meData.user.departmentId || '';
            setUser({
              name: meData.user.name || 'Department Head',
              role: 'DEPARTMENT_HEAD',
              departmentId: deptId,
            });
          }
        }

        if (!deptId) {
          throw new Error('Department Head is not assigned to a department.');
        }

        const res = await fetch(`/api/departments/${deptId}/staff`);
        if (!res.ok) {
          throw new Error('Failed to fetch team roster');
        }

        const data = await res.json();
        setDepartment(data.department || null);
        setOfficers(data.officers || []);
        setFieldWorkers(data.fieldWorkers || []);
      } catch (err: any) {
        setError(err.message || 'Error loading team roster');
      } finally {
        setLoading(false);
      }
    }

    fetchRoster();
  }, []);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="border-b pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              <span>Department Team Roster</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Read-only view of officers and active field workers registered under{' '}
              <span className="font-semibold text-foreground">{department?.name || 'your department'}</span>.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono self-start sm:self-auto">
            {officers.length} Officer(s) | {fieldWorkers.length} Field Worker(s)
          </Badge>
        </div>

        {loading ? (
          <Card className="p-6 space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ) : error ? (
          <Card className="p-8 text-center border-destructive/20 bg-destructive/5 text-destructive text-xs font-medium">
            {error}
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Officers Roster */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Department Officers</CardTitle>
                <CardDescription className="text-xs">
                  Administrative officers authorized to manage department complaints.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {officers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground italic">
                    No officers registered in this department.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {officers.map((off) => (
                        <TableRow key={off.id}>
                          <TableCell className="font-bold text-foreground">{off.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {off.role.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {off.email ? (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5" />
                                {off.email}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="success">Authorized</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(off.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Field Workers Roster */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Active Field Workers</CardTitle>
                <CardDescription className="text-xs">
                  Municipal ground staff conducting physical resolution and evidence upload.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {fieldWorkers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground italic">
                    No active field workers registered in this department.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker Name</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fieldWorkers.map((fw) => (
                        <TableRow key={fw.id}>
                          <TableCell className="font-bold text-foreground">{fw.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="h-3.5 w-3.5" />
                              {fw.phoneNumber}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={fw.isActive ? 'success' : 'outline'}>
                              {fw.isActive ? 'Active Field Staff' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(fw.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
