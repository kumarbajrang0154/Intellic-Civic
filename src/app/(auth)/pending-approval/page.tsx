import Link from 'next/link';
import { Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-lg border-amber-500/30">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 mb-2">
              <Clock className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
            <CardDescription>
              Your staff Google account has been registered successfully.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 text-center">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 text-sm text-amber-800 dark:text-amber-300 text-left space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-5 w-5 flex-shrink-0" />
                <span>Super Admin Review Required</span>
              </div>
              <p className="text-xs leading-relaxed">
                To protect municipal operations, newly registered staff accounts must be authorized and assigned a department role by a Super Admin before accessing the platform.
              </p>
            </div>

            <div className="flex gap-3">
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full">Return Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
