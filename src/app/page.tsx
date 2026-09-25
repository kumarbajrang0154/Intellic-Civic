import Link from 'next/link';
import Image from 'next/image';
import { Shield, User, Building2, CheckCircle, Cpu, FileSpreadsheet, Phone, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPlatformSettings } from '@/lib/settings-store';

export const revalidate = 60; // Revalidate dynamic settings every minute

export default async function LandingPage() {
  const settings = await getPlatformSettings();

  return (
    <div className="min-h-screen bg-brand-wash flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs gap-2 min-w-0 sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-lg sm:text-xl text-slate-900 truncate min-w-0">
          {settings.logoUrl ? (
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded">
              <Image
                src={settings.logoUrl}
                alt={settings.platformName}
                width={28}
                height={28}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-[#2563EB] to-[#0891B2] text-white flex items-center justify-center shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
          )}
          <span className="truncate font-bold tracking-tight">
            {settings.shortName || 'IntelliCivic'}<span className="hidden sm:inline text-slate-600 font-normal"> Platform</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/login/citizen">
            <Button variant="outline" size="sm" className="px-3 text-xs sm:text-sm font-medium">
              Citizen Login
            </Button>
          </Link>
          <Link href="/login/staff">
            <Button size="sm" className="px-3 text-xs sm:text-sm font-semibold">
              Staff Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center text-center space-y-6 sm:space-y-8 min-w-0">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-950 border border-blue-300 text-xs font-semibold max-w-full shadow-2xs">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="truncate">AI-Powered Smart City Governance</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl leading-[1.15]">
          Empowering Cities with{' '}
          <span className="bg-gradient-to-r from-[#2563EB] via-[#0284C7] to-[#0891B2] bg-clip-text text-transparent">
            Intelligent Civic Resolution
          </span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed">
          Report issues, track resolution transparently, and leverage automated AI triage to deliver municipal services faster.
        </p>

        {/* Login Selection CTAs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl pt-4">
          <Card className="hover:shadow-md transition-shadow border-slate-200 bg-white/90">
            <CardHeader className="text-left">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white mb-2 shadow-xs">
                <User className="h-5 w-5" />
              </div>
              <CardTitle className="typo-h3">Citizen Portal</CardTitle>
              <CardDescription className="typo-caption text-slate-600">
                Submit civic complaints, upload photo evidence, and track real-time resolution.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-left">
              <Link href="/login/citizen">
                <Button className="w-full">Login with Mobile OTP</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-slate-200 bg-white/90">
            <CardHeader className="text-left">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white mb-2 shadow-xs">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle className="typo-h3">Municipal Staff Portal</CardTitle>
              <CardDescription className="typo-caption text-slate-600">
                Department heads, officers, field workers, and admins managing triage queues.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-left">
              <Link href="/login/staff">
                <Button variant="secondary" className="w-full">
                  Sign in with Google
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-10 text-left">
          <div className="flex gap-4 items-start p-4 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-xs shadow-2xs">
            <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-900 border border-blue-200 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Instant OTP Access</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">Seamless, passwordless authentication for citizens via SMS OTP.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-xs shadow-2xs">
            <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-900 border border-purple-200 flex items-center justify-center shrink-0">
              <Cpu className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Automated AI Triage</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">Gemini AI analyzes complaint descriptions and evidence to route complaints instantly.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-xs shadow-2xs">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Department Scoping</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">Strict role-based access control protecting municipal workflows and citizen privacy.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Dynamic Footer */}
      <footer className="border-t border-slate-200 py-8 bg-white/90 px-4 sm:px-6 text-center text-sm text-slate-600 space-y-3">
        <div className="max-w-4xl mx-auto space-y-2">
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            {settings.footerDescription}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-800 pt-1">
            {settings.officialPhone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-blue-600" /> {settings.officialPhone}
              </span>
            )}
            {settings.supportEmail && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-blue-600" /> {settings.supportEmail}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs pt-2 border-t border-slate-200/60 font-mono text-slate-500">
          {settings.copyrightText}
        </div>
      </footer>
    </div>
  );
}