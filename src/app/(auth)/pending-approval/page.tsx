import Link from 'next/link';
import { Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-xs border border-slate-200 bg-white rounded-xl border-l-4 border-l-amber-500">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-1 shadow-xs">
              <Clock className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold text-[#172033]">Account Pending Approval</CardTitle>
            <CardDescription className="text-xs text-slate-500 leading-relaxed">
              Your staff Google account has been registered successfully.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 text-center">
            <div className="p-4 bg-amber-50/60 rounded-lg border border-amber-200 text-sm text-amber-900 text-left space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-5 w-5 flex-shrink-0 text-amber-600" />
                <span>Super Admin Review Required</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-800">
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
