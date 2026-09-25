'use client';

import * as React from 'react';
import { Mail, Building2, Shield, UserCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DepartmentHeadProfilePage() {
  const [user, setUser] = React.useState<{
    name: string;
    role: 'DEPARTMENT_HEAD';
    email?: string;
    departmentId?: string;
  }>({
    name: 'Department Head',
    role: 'DEPARTMENT_HEAD',
  });

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser({
            name: data.user.name || 'Department Head',
            role: 'DEPARTMENT_HEAD',
            email: data.user.email,
            departmentId: data.user.departmentId,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AppShell user={user}>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Department Head Profile</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Your authorized Department Head account details and administrative scope.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-purple-100 text-purple-700 font-bold text-lg flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <CardTitle className="text-base font-bold">{user.name}</CardTitle>
                <Badge variant="outline" className="text-xs mt-1 border-purple-300 text-purple-700 bg-purple-50">
                  DEPARTMENT HEAD
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-4 text-xs">
            <div className="flex items-center gap-3 pt-3 border-t">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold block">Email Address</span>
                <span className="text-muted-foreground">{user.email || 'head@city.gov.in'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold block">Department Scope</span>
                <span className="text-muted-foreground">{user.departmentId || 'Assigned Department'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold block">Authorization Status</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                  <UserCheck className="h-3.5 w-3.5 inline" /> Authorized Head Account
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
