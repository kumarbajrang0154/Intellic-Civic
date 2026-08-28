'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Building2,
  CheckSquare,
  FileText,
  Home,
  LogOut,
  Menu,
  PlusCircle,
  Shield,
  User,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type UserRole =
  | 'CITIZEN'
  | 'DEPARTMENT_HEAD'
  | 'DEPARTMENT_OFFICER'
  | 'FIELD_WORKER'
  | 'ADMIN';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_CONFIG: Record<UserRole, NavItem[]> = {
  CITIZEN: [
    { title: 'My Complaints', href: '/citizen', icon: FileText },
    { title: 'New Complaint', href: '/citizen/new', icon: PlusCircle },
    { title: 'Profile', href: '/citizen/profile', icon: User },
  ],
  DEPARTMENT_HEAD: [
    { title: 'Department Queue', href: '/staff', icon: Building2 },
    { title: 'All Complaints', href: '/staff/all', icon: FileText },
    { title: 'Profile', href: '/staff/profile', icon: User },
  ],
  DEPARTMENT_OFFICER: [
    { title: 'Department Queue', href: '/staff', icon: Building2 },
    { title: 'All Complaints', href: '/staff/all', icon: FileText },
    { title: 'Profile', href: '/staff/profile', icon: User },
  ],
  FIELD_WORKER: [
    { title: 'My Assignments', href: '/field-worker', icon: CheckSquare },
    { title: 'Profile', href: '/field-worker/profile', icon: User },
  ],
  ADMIN: [
    { title: 'All Complaints', href: '/admin', icon: FileText },
    { title: 'Triage Queue', href: '/admin/triage', icon: AlertCircle },
    { title: 'Departments', href: '/admin/departments', icon: Building2 },
    { title: 'Users', href: '/admin/users', icon: Users },
    { title: 'Profile', href: '/admin/profile', icon: User },
  ],
};

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name?: string;
    email?: string;
    role: UserRole;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const navItems = NAV_CONFIG[user.role] || NAV_CONFIG.CITIZEN;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b bg-card px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
            <Shield className="h-6 w-6 text-primary" />
            <span>IntelliCivic</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right text-xs">
            <span className="font-semibold text-foreground">{user.name || 'User'}</span>
            <span className="text-muted-foreground font-mono uppercase">{user.role}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r bg-card p-4 space-y-2">
          <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
            Navigation ({user.role})
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="w-64 h-full bg-card p-4 space-y-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="font-bold text-primary">IntelliCivic</span>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="text-xs font-semibold uppercase text-muted-foreground px-2">
                Navigation ({user.role})
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 bg-background max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
