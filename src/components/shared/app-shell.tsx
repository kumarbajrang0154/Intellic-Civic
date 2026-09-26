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
      { type: 'leaf', title: 'My Profile', href: '/admin/profile', icon: User },
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
      { type: 'leaf', title: 'My Profile', href: '/admin/profile', icon: User },
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

const FIELD_WORKER_NAV: NavSection[] = [
  {
    label: 'MAIN',
    items: [
      { type: 'leaf', title: 'Dashboard', href: '/field-worker', icon: LayoutDashboard },
    ],
  },
  {
    label: 'WORK',
    items: [
      { type: 'leaf', title: 'My Assignments', href: '/field-worker/complaints', icon: ClipboardList },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { type: 'leaf', title: 'Profile Settings', href: '/field-worker/profile', icon: User },
    ],
  },
];

const CITIZEN_NAV: NavSection[] = [
  {
    label: 'PORTAL',
    items: [
      { type: 'leaf', title: 'Dashboard', href: '/citizen', icon: Home },
      { type: 'leaf', title: 'Report Complaint', href: '/citizen/complaints/new', icon: PlusCircle },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { type: 'leaf', title: 'Notifications', href: '/citizen/notifications', icon: Bell },
      { type: 'leaf', title: 'Profile Settings', href: '/citizen/profile', icon: User },
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
    case 'FIELD_WORKER':
      return FIELD_WORKER_NAV;
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
    case 'ADMIN':
      return 'bg-indigo-100 text-indigo-950 border border-indigo-300 font-semibold';
    case 'DEPARTMENT_HEAD':
      return 'bg-purple-100 text-purple-950 border border-purple-300 font-semibold';
    case 'DEPARTMENT_OFFICER':
      return 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-semibold';
    case 'FIELD_WORKER':
      return 'bg-cyan-100 text-cyan-950 border border-cyan-300 font-semibold';
    default:
      return 'bg-slate-100 text-slate-900 border border-slate-300 font-semibold';
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
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 group select-none',
        indent ? 'ml-3 pl-3.5 border-l border-slate-200' : '',
        isActive
          ? 'bg-blue-50 text-[#2563EB] font-bold border-l-4 border-[#2563EB] shadow-2xs'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'w-4 h-4 shrink-0 transition-colors',
            isActive ? 'text-[#2563EB]' : 'text-slate-500 group-hover:text-slate-900',
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
          'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 group select-none',
          isGroupActive
            ? 'bg-slate-100 text-slate-900 font-bold border-l-4 border-[#2563EB]'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        )}
      >
        <Icon
          className={cn(
            'w-4 h-4 shrink-0 transition-colors',
            isGroupActive ? 'text-[#2563EB]' : 'text-slate-500 group-hover:text-slate-900',
          )}
        />
        <span className="flex-1 text-left truncate">{item.title}</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
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
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Logo Header */}
      <div className="px-4 py-4 border-b border-slate-200">
        <Link href="/" className="flex items-center gap-3 group" onClick={onLinkClick}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#2563EB] to-[#0891B2] flex items-center justify-center shrink-0 shadow-xs text-white">
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
            <div className="text-slate-900 font-extrabold text-sm leading-tight tracking-wide truncate">
              {platformInfo.platformName.toUpperCase()}
            </div>
            <div className="text-slate-500 text-[10px] font-semibold tracking-widest uppercase leading-tight mt-0.5">
              Civic Intelligence Platform
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.label && (
              <div className="px-3 pb-1.5 pt-1 text-[11px] font-bold tracking-widest text-slate-500 uppercase">
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
      <div className="border-t border-slate-200 p-3 space-y-2">
        {/* Profile Card */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2563EB] to-[#0891B2] flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-xs overflow-hidden">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name || 'Avatar'} className="w-full h-full object-cover" />
            ) : (
              (user.name || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {user.name || 'Admin'}
            </div>
            <span
              className={cn(
                'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5',
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
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors w-full"
            onClick={onLinkClick}
          >
            <Globe className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span>View Citizen Portal</span>
          </Link>
        )}

        {/* Sign Out */}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors w-full"
        >
          <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
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
    avatarUrl?: string | null;
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
  // Self-fetched avatarUrl — overlaid on whatever the page passes in.
  // This is the single fix point so every page automatically shows the photo.
  const [selfAvatarUrl, setSelfAvatarUrl] = React.useState<string | null | undefined>(undefined);

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

  // Fetch the real avatarUrl from /api/auth/me so every page (not just profile
  // pages) shows the actual photo in the topbar and sidebar without requiring
  // each individual page to forward avatarUrl through the user prop.
  React.useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.user?.avatarUrl !== undefined) {
          setSelfAvatarUrl(data.user.avatarUrl);
        } else {
          setSelfAvatarUrl(null);
        }
      })
      .catch(() => setSelfAvatarUrl(null));
  }, []);

  // Merge: prefer the page-supplied avatarUrl (e.g. profile page after upload),
  // then our self-fetched value, then null.
  const effectiveAvatarUrl =
    user.avatarUrl !== undefined
      ? user.avatarUrl           // page explicitly provided it (profile pages)
      : selfAvatarUrl ?? null;   // fall back to self-fetched

  const effectiveUser = { ...user, avatarUrl: effectiveAvatarUrl };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/');
      router.refresh();
    }
  };

  // Citizen layout: same sidebar shell as admin/staff (Part B fix)

  return (
    <div className="min-h-screen flex bg-brand-wash">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-30 shadow-xl">
        <SidebarContent
          user={effectiveUser}
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
          {/* Drawer — max-w-[85vw] ensures it never overflows on narrow phones */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl overflow-hidden">
            <SidebarContent
              user={effectiveUser}
              pathname={pathname}
              platformInfo={platformInfo}
              onLinkClick={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* ── Main Area ── */}
      <div className="flex-1 min-w-0 flex flex-col lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-xs px-3 sm:px-6 py-3 flex items-center justify-between gap-2 min-w-0">
          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Mobile menu toggle */}
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb — desktop */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 min-w-0">
              <span className="text-slate-900 font-bold tracking-tight truncate max-w-[120px] md:max-w-none">{platformInfo.platformName}</span>
              <span className="shrink-0">/</span>
              <span className="text-ic-blue font-semibold uppercase tracking-wider text-[11px] truncate">{getRoleLabel(effectiveUser.role)} Portal</span>
            </div>

            {/* Brand — mobile (sm and below) */}
            <div className="flex items-center gap-1.5 sm:hidden min-w-0">
              <Shield className="w-4 h-4 text-ic-blue shrink-0" />
              <span className="font-bold text-slate-900 text-sm truncate">{platformInfo.platformName}</span>
            </div>
          </div>

          {/* Right side header actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Notifications bell */}
            <Link
              href={isAdminRole(effectiveUser.role) ? '/admin/notifications' : effectiveUser.role === 'CITIZEN' ? '/citizen/notifications' : '#'}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
            </Link>

            {/* User info — hidden on xs, visible from sm+ */}
            <div className="hidden sm:flex items-center gap-2 pl-2.5 border-l border-slate-200 min-w-0">
              {/* Avatar circle */}
              <div className="w-8 h-8 rounded-full bg-ic-blue flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-xs overflow-hidden">
                {effectiveUser.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={effectiveUser.avatarUrl} alt={effectiveUser.name || 'Avatar'} className="w-full h-full object-cover" />
                ) : (
                  (effectiveUser.name || 'U').charAt(0).toUpperCase()
                )}
              </div>
              {/* Name + role — only on md+ to avoid overflow on tablets */}
              <div className="hidden md:block min-w-0 max-w-[140px] lg:max-w-[180px]">
                <div className="text-sm font-semibold text-slate-900 leading-tight truncate">
                  {effectiveUser.name || 'User'}
                </div>
                <div className="text-[11px] text-slate-500 font-mono uppercase leading-tight truncate">
                  {getRoleLabel(effectiveUser.role)}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden bg-[#F6F8FB]">
          {children}
        </main>
      </div>
    </div>
  );
}
