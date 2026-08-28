import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default function CitizenDashboardPage() {
  const mockUser = {
    name: 'Citizen Portal',
    role: 'CITIZEN' as const,
  };

  return (
    <AppShell user={mockUser}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome to Citizen Portal</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Submit complaints, track live progress, and review resolution histories.
            </p>
          </div>
          <Link href="/citizen/new">
            <Button className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              File New Complaint
            </Button>
          </Link>
        </div>

        {/* Empty State */}
        <Card className="border-dashed py-12 text-center">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <FileText className="h-8 w-8" />
            </div>
            <div className="space-y-1 max-w-sm">
              <CardTitle className="text-xl">No Complaints Filed Yet</CardTitle>
              <CardDescription>
                You haven&apos;t submitted any civic complaints. Click below to submit your first report with photo evidence.
              </CardDescription>
            </div>
            <Link href="/citizen/new">
              <Button size="sm">File First Complaint</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
