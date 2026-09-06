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
        <Card className="shadow-xs border border-[#E2E8F0] bg-white rounded-xl">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="mx-auto h-12 w-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-1 shadow-xs">
              <Clock className="h-6 w-6" />
            </div>

            {/* Status Badge */}
            <div className="flex justify-center pb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                <span>Awaiting Super Admin Approval</span>
              </span>
            </div>

            <CardTitle className="text-2xl font-bold text-[#0F2747] tracking-tight">
              Account Under Review
            </CardTitle>
            <CardDescription className="text-xs text-[#475569] leading-relaxed">
              Your staff account has been registered successfully and is waiting for Super Admin authorization.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 text-center">
            <div className="p-4 bg-amber-50/60 rounded-lg border border-amber-200 text-left space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-xs text-[#0F2747]">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Super Admin Review Required</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                To protect municipal operations, newly registered staff accounts must be verified and assigned an active department role by a Super Admin before accessing the platform.
              </p>
            </div>

            <div className="flex gap-3">
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full h-11 border-[#CBD5E1] text-[#172033] font-semibold hover:bg-slate-50 text-sm rounded-lg shadow-xs">
                  Return Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
