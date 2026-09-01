import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function StaffDashboardPage() {
  const mockUser = {
    name: 'Department Officer',
    role: 'DEPARTMENT_OFFICER' as const,
  };

  return (
    <AppShell user={mockUser}>
      <div className="space-y-6">
        <div className="border-b pb-5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Department Queue Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage assigned complaints, update progress statuses, and review AI triage suggestions.
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Complaints awaiting officer review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
              <AlertTriangle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Active field work & resolution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Resolved This Month</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Successfully closed tickets</p>
            </CardContent>
          </Card>
        </div>

        {/* Queue Empty State */}
        <Card className="border-dashed py-12 text-center">
          <CardContent className="flex flex-col items-center justify-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl">Department Queue Clear</CardTitle>
            <CardDescription className="max-w-sm">
              There are currently no active complaints assigned to your department queue.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
