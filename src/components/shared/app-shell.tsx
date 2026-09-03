'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Brain,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Globe,
  Home,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  PlusCircle,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type UserRole =
  | 'CITIZEN'
  | 'DEPARTMENT_HEAD'
  | 'DEPARTMENT_OFFICER'
  | 'FIELD_WORKER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

// ─── Nav Types ──────────────────────────────────────────────────────────────

interface NavLeaf {
  type: 'leaf';
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  type: 'group';
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavLeaf[];
  /** If set, this href is used to check if any child is active */
  baseHref?: string;
}

interface NavSection {
  label?: string;
  items: (NavLeaf | NavGroup)[];
}

// ─── Nav Config per Role ────────────────────────────────────────────────────

const SUPER_ADMIN_NAV: NavSection[] = [
  {
    label: 'MAIN',
    items: [
      { type: 'leaf', title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      {
        type: 'group',
        title: 'Complaints',
        icon: ClipboardList,
        baseHref: '/admin/complaints',
        children: [
          { type: 'leaf', title: 'All Complaints', href: '/admin/complaints' },
          { type: 'leaf', title: 'Pending Review', href: '/admin/complaints/pending' },
          { type: 'leaf', title: 'In Progress', href: '/admin/complaints/in-progress' },
          { type: 'leaf', title: 'Resolved', href: '/admin/complaints/resolved' },
          { type: 'leaf', title: 'Escalated', href: '/admin/complaints/escalated' },
        ],
      },
      {
        type: 'group',
        title: 'Departments',
        icon: Building2,
        baseHref: '/admin/departments',
        children: [
          { type: 'leaf', title: 'All Departments', href: '/admin/departments' },
          { type: 'leaf', title: 'Department Heads', href: '/admin/departments/heads' },
          { type: 'leaf', title: 'Dept. Officers', href: '/admin/departments/officers' },
        ],
      },
      {
        type: 'group',
        title: 'Users',
        icon: Users,
        baseHref: '/admin/users',
        children: [
          { type: 'leaf', title: 'Citizens', href: '/admin/users/citizens' },
          { type: 'leaf', title: 'Admin Accounts', href: '/admin/users/admin-accounts' },
        ],
      },
      {
        type: 'group',
        title: 'AI Management',
        icon: Brain,
        baseHref: '/admin/ai',
        children: [
          { type: 'leaf', title: 'Processing Logs', href: '/admin/ai/logs' },
          { type: 'leaf', title: 'Classification', href: '/admin/ai/classification' },
          { type: 'leaf', title: 'AI Performance', href: '/admin/ai/performance' },
        ],
      },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { type: 'leaf', title: 'Analytics & Reports', href: '/admin/analytics', icon: BarChart3 },
      { type: 'leaf', title: 'Notifications', href: '/admin/notifications', icon: Bell },
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { type: 'leaf', title: 'Security & Access', href: '/admin/security', icon: ShieldCheck },
      { type: 'leaf', title: 'System Management', href: '/admin/system', icon: Settings },
      { type: 'leaf', title: 'Organization Settings', href: '/admin/settings', icon: Globe },
    ],
  },
];

const ADMIN_NAV: NavSection[] = [
  {
    label: 'MAIN',
    items: [
      { type: 'leaf', title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { type: 'leaf', title: 'Triage Queue', href: '/admin/triage', icon: AlertTriangle },
      {
        type: 'group',
        title: 'Complaints',
        icon: ClipboardList,
        baseHref: '/admin/complaints',
        children: [
          { type: 'leaf', title: 'All Complaints', href: '/admin/complaints' },
          { type: 'leaf', title: 'Pending Review', href: '/admin/complaints/pending' },
          { type: 'leaf', title: 'In Progress', href: '/admin/complaints/in-progress' },
          { type: 'leaf', title: 'Resolved', href: '/admin/complaints/resolved' },
        ],
      },
      { type: 'leaf', title: 'Departments', href: '/admin/departments', icon: Building2 },
      { type: 'leaf', title: 'Users', href: '/admin/users', icon: Users },
      { type: 'leaf', title: 'Categories', href: '/admin/categories', icon: Sparkles },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { type: 'leaf', title: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { type: 'leaf', title: 'Notifications', href: '/admin/notifications', icon: Bell },
      { type: 'leaf', title: 'Platform Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

const DEPT_HEAD_NAV: NavSection[] = [
  {
    label: 'MAIN',
    items: [
      { type: 'leaf', title: 'Dashboard', href: '/dept-head', icon: LayoutDashboard },
    ],
  },
  {
    label: 'MY DEPARTMENT',
    items: [
      { type: 'leaf', title: 'Department Queue', href: '/dept-head/complaints', icon: ClipboardList },
      { type: 'leaf', title: 'AI Suggestions', href: '/dept-head/ai-suggestions', icon: Sparkles },
      { type: 'leaf', title: 'Team Roster', href: '/dept-head/team', icon: Users },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { type: 'leaf', title: 'Profile', href: '/dept-head/profile', icon: User },
    ],
  },
];

const OFFICER_NAV: NavSection[] = [
  {
    label: 'MAIN',
    items: [
      { type: 'leaf', title: 'Dashboard', href: '/officer', icon: LayoutDashboard },
    ],
  },
  {
    label: 'WORK',
    items: [
      { type: 'leaf', title: 'My Complaints', href: '/officer/complaints', icon: ClipboardList },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { type: 'leaf', title: 'Profile', href: '/officer/profile', icon: User },
    ],
  },
];

const CITIZEN_NAV: NavSection[] = [
  {
    items: [
      { type: 'leaf', title: 'My Complaints', href: '/citizen', icon: FileText },
      { type: 'leaf', title: 'New Complaint', href: '/citizen/complaints/new', icon: PlusCircle },
      { type: 'leaf', title: 'Profile', href: '/citizen/profile', icon: User },
    ],
  },
];

function getNavSections(role: UserRole): NavSection[] {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN': // ADMIN = Super Admin in this platform
      return SUPER_ADMIN_NAV;
    case 'DEPARTMENT_HEAD':
      return DEPT_HEAD_NAV;
    case 'DEPARTMENT_OFFICER':
      return OFFICER_NAV;
    case 'CITIZEN':
      return CITIZEN_NAV;
    default:
      return CITIZEN_NAV;
  }
}

function isAdminRole(role: UserRole) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

// ─── Role badge colours ──────────────────────────────────────────────────────

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-amber-400/20 text-amber-300 border border-amber-400/30';
    case 'ADMIN':
      return 'bg-blue-400/20 text-blue-300 border border-blue-400/30';
    case 'DEPARTMENT_HEAD':
      return 'bg-purple-400/20 text-purple-300 border border-purple-400/30';
    case 'DEPARTMENT_OFFICER':
      return 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30';
    default:
      return 'bg-slate-400/20 text-slate-300 border border-slate-400/30';
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'Admin';
    case 'DEPARTMENT_HEAD':
      return 'Dept. Head';
    case 'DEPARTMENT_OFFICER':
      return 'Officer';
    case 'CITIZEN':
      return 'Citizen';
    default:
      return role;
  }
}

// ─── Sidebar Nav Leaf ────────────────────────────────────────────────────────

function SidebarLeaf({
  item,
  isActive,
  indent = false,
  onClick,
}: {
  item: NavLeaf;
  isActive: boolean;
  indent?: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group',
        indent ? 'ml-4 pl-3 border-l border-white/10' : '',
        isActive
          ? 'bg-ic-action text-white shadow-sm'
          : 'text-slate-300 hover:bg-white/8 hover:text-white',
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'w-4 h-4 shrink-0 transition-colors',
            isActive ? 'text-white' : 'text-slate-400 group-hover:text-white',
          )}
        />
      )}
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

// ─── Sidebar Nav Group ───────────────────────────────────────────────────────

function SidebarGroup({
  item,
  pathname,
  onClick,
}: {
  item: NavGroup;
  pathname: string;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  const isGroupActive =
    item.children.some((c) => pathname === c.href) ||
    (item.baseHref ? pathname.startsWith(item.baseHref) : false);

  const [open, setOpen] = React.useState(isGroupActive);

  // Auto-open when navigating into this group
  React.useEffect(() => {
    if (isGroupActive) setOpen(true);
  }, [isGroupActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group',
          isGroupActive
            ? 'text-white bg-white/10'
            : 'text-slate-300 hover:bg-white/8 hover:text-white',
        )}
      >
        <Icon
          className={cn(
            'w-4 h-4 shrink-0',
            isGroupActive ? 'text-ic-action' : 'text-slate-400 group-hover:text-slate-200',
          )}
        />
        <span className="flex-1 text-left truncate">{item.title}</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="mt-1 space-y-0.5">
          {item.children.map((child) => (
            <SidebarLeaf
              key={child.href}
              item={child}
              isActive={pathname === child.href}
              indent
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar Content ─────────────────────────────────────────────────────────

function SidebarContent({
  user,
  pathname,
  platformInfo,
  onLinkClick,
  onLogout,
}: {
  user: AppShellProps['user'];
  pathname: string;
  platformInfo: { platformName: string; logoUrl: string | null };
  onLinkClick?: () => void;
  onLogout: () => void;
}) {
  const sections = getNavSections(user.role);

  return (
    <div className="flex flex-col h-full bg-ic-navy">
      {/* Logo Header */}
      <div className="px-4 py-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3 group" onClick={onLinkClick}>
          <div className="w-9 h-9 rounded-lg bg-ic-action flex items-center justify-center shrink-0 shadow-lg">
            {platformInfo.logoUrl ? (
              <Image
                src={platformInfo.logoUrl}
                alt={platformInfo.platformName}
                width={28}
                height={28}
                className="w-7 h-7 object-contain rounded"
              />
            ) : (
              <Shield className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-tight tracking-wide truncate">
              {platformInfo.platformName.toUpperCase()}
            </div>
            <div className="text-slate-400 text-[10px] font-medium tracking-widest uppercase leading-tight">
              Admin Portal
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.label && (
              <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                if (item.type === 'leaf') {
                  return (
                    <SidebarLeaf
                      key={item.href}
                      item={item}
                      isActive={pathname === item.href}
                      onClick={onLinkClick}
                    />
                  );
                } else {
                  return (
                    <SidebarGroup
                      key={item.title}
                      item={item}
                      pathname={pathname}
                      onClick={onLinkClick}
                    />
                  );
                }
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Profile + Actions */}
      <div className="border-t border-white/10 p-3 space-y-2">
        {/* Profile Card */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="w-9 h-9 rounded-full bg-ic-action flex items-center justify-center shrink-0 text-white font-bold text-sm">
            {(user.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">
              {user.name || 'Admin'}
            </div>
            <span
              className={cn(
                'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                getRoleBadgeClass(user.role),
              )}
            >
              {getRoleLabel(user.role)}
            </span>
          </div>
        </div>

        {/* View Citizen Portal */}
        {isAdminRole(user.role) && (
          <Link
            href="/citizen"
            target="_blank"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/8 rounded-lg transition-colors w-full"
            onClick={onLinkClick}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span>View Citizen Portal</span>
          </Link>
        )}

        {/* Sign Out */}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

// ─── App Shell Props ─────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name?: string;
    email?: string;
    role: UserRole;
  };
}

// ─── App Shell ───────────────────────────────────────────────────────────────

export function AppShell({ children, user }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [platformInfo, setPlatformInfo] = React.useState<{
    platformName: string;
    logoUrl: string | null;
  }>({
    platformName: 'IntelliCivic',
    logoUrl: null,
  });

  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          setPlatformInfo({
            platformName:
              data.settings.shortName || data.settings.platformName || 'IntelliCivic',
            logoUrl: data.settings.logoUrl || null,
          });
        }
      })
      .catch((err) => console.warn('[APPSHELL] Failed to fetch settings:', err));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/');
      router.refresh();
    }
  };

  // Citizen layout uses simple top-nav only
  if (user.role === 'CITIZEN') {
    return (
      <div className="min-h-screen bg-ic-light flex flex-col">
        <header className="sticky top-0 z-40 border-b bg-white px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
          <Link href="/" className="flex items-center gap-2 font-bold text-ic-navy">
            <Shield className="h-5 w-5 text-ic-action" />
            <span>{platformInfo.platformName}</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 hidden sm:block">{user.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-ic-light">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-30 shadow-xl">
        <SidebarContent
          user={user}
          pathname={pathname}
          platformInfo={platformInfo}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl">
            <SidebarContent
              user={user}
              pathname={pathname}
              platformInfo={platformInfo}
              onLinkClick={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb area — brand name for mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <Shield className="w-5 h-5 text-ic-action" />
              <span className="font-bold text-ic-navy text-sm">{platformInfo.platformName}</span>
            </div>
          </div>

          {/* Right side header actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications bell */}
            <Link
              href={isAdminRole(user.role) ? '/admin/notifications' : '#'}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
            </Link>

            {/* User info */}
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-ic-action flex items-center justify-center text-white text-sm font-bold shrink-0">
                {(user.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  {user.name || 'User'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono uppercase leading-tight">
                  {getRoleLabel(user.role)}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
