import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthDeniedPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-lg border-destructive/30">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2">
              <XCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription>
              Your staff account access request was not approved.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 text-center">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact your municipal IT administrator.
            </p>
            <Link href="/" className="block w-full">
              <Button variant="outline" className="w-full">Return to Landing Page</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
