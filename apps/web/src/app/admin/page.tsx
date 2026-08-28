import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertCircle, Users, Building2 } from 'lucide-react';

export default function AdminDashboardPage() {
  const mockUser = {
    name: 'Super Admin',
    role: 'ADMIN' as const,
  };

  return (
    <AppShell user={mockUser}>
      <div className="space-y-6">
        <div className="border-b pb-5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Super Admin Triage & System Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            System-wide complaint monitoring, unassigned triage queue, user management, and department controls.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unassigned Queue</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Complaints requiring triage</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Complaints</CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Platform-wide total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Departments</CardTitle>
              <Building2 className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-muted-foreground mt-1">Configured municipal units</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Staff Approvals</CardTitle>
              <Users className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">OAuth users awaiting role</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-dashed py-12 text-center">
          <CardContent className="flex flex-col items-center justify-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Shield className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl">Super Admin Dashboard Ready</CardTitle>
            <CardDescription className="max-w-sm">
              All platform systems operating normally. Triage queues and user authorizations are up to date.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
