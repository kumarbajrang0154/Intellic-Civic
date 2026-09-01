import Link from 'next/link';
import { Shield, User, Building2, CheckCircle, Cpu, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm gap-2 min-w-0">
        <div className="flex items-center gap-2 font-bold text-lg sm:text-xl text-primary truncate min-w-0">
          <Shield className="h-6 w-6 shrink-0" />
          <span className="truncate">IntelliCivic<span className="hidden sm:inline"> Platform</span></span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/login/citizen">
            <Button variant="outline" size="sm" className="px-2.5 sm:px-3 text-xs sm:text-sm">Citizen Login</Button>
          </Link>
          <Link href="/login/staff">
            <Button size="sm" className="px-2.5 sm:px-3 text-xs sm:text-sm">Staff Login</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-16 flex flex-col items-center text-center space-y-6 sm:space-y-8 min-w-0">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold max-w-full">
          <Cpu className="h-4 w-4 shrink-0" />
          <span className="truncate">AI-Powered Smart City Governance</span>
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl leading-tight">
          Empowering Cities with Intelligent Civic Resolution
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl leading-normal">
          Report issues, track resolution transparently, and leverage automated AI triage to deliver municipal services faster.
        </p>

        {/* Login Selection CTAs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl pt-6">
          <Card className="hover:shadow-md transition-shadow border-primary/20">
            <CardHeader className="text-left">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                <User className="h-6 w-6" />
              </div>
              <CardTitle>Citizen Portal</CardTitle>
              <CardDescription>
                Submit civic complaints, upload photo evidence, and track real-time resolution.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-left">
              <Link href="/login/citizen">
                <Button className="w-full">
                  Login with Mobile OTP
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-primary/20">
            <CardHeader className="text-left">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                <Building2 className="h-6 w-6" />
              </div>
              <CardTitle>Municipal Staff Portal</CardTitle>
              <CardDescription>
                Department heads, officers, field workers, and admins managing triage queues.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-left">
              <Link href="/login/staff">
                <Button variant="outline" className="w-full">
                  Sign in with Google
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-12 text-left">
          <div className="flex gap-4 items-start p-4 rounded-lg border bg-card">
            <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground">Instant OTP Access</h3>
              <p className="text-sm text-muted-foreground">Seamless, passwordless authentication for citizens via SMS OTP.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-lg border bg-card">
            <Cpu className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground">Automated AI Triage</h3>
              <p className="text-sm text-muted-foreground">Gemini AI analyzes complaint descriptions and evidence to route complaints instantly.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-lg border bg-card">
            <FileSpreadsheet className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground">Department Scoping</h3>
              <p className="text-sm text-muted-foreground">Strict role-based access control protecting municipal workflows and citizen privacy.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © 2026 IntelliCivic Smart City Platform. All rights reserved.
      </footer>
    </div>
  );
}
