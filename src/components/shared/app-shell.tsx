'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Brain,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Globe,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OfflineBanner } from './OfflineBanner';

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
          { type: 'leaf', title: 'Staff & User Management', href: '/admin/staff' },
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
      { type: 'leaf', title: 'My Assignments', href: '/field-worker', icon: ClipboardList },
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

function getNotificationHref(role?: string): string | null {
  if (!role) return null;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return '/admin/notifications';
  }
  if (role === 'CITIZEN') {
    return '/citizen/notifications';
  }
  return null;
}

// ─── Role badge colours ──────────────────────────────────────────────────────

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

function getPageTitle(pathname: string, _role: UserRole): string {
  if (pathname === '/admin') return 'Admin Overview';
  if (pathname.startsWith('/admin/complaints')) return 'Complaint Management';
  if (pathname.startsWith('/admin/triage')) return 'AI Complaint Triage';
  if (pathname.startsWith('/admin/departments')) return 'Department Administration';
  if (pathname.startsWith('/admin/staff')) return 'Staff & User Directory';
  if (pathname.startsWith('/admin/security')) return 'Security & Access Logs';
  if (pathname.startsWith('/admin/settings')) return 'Platform Settings';
  if (pathname === '/citizen') return 'Citizen Dashboard';
  if (pathname.startsWith('/citizen/complaints/new')) return 'File a New Complaint';
  if (pathname.startsWith('/citizen/complaints')) return 'Complaint Tracking';
  if (pathname.startsWith('/citizen/profile')) return 'Citizen Profile';
  if (pathname.startsWith('/citizen/notifications')) return 'Notifications';
  if (pathname === '/dept-head') return 'Department Overview';
  if (pathname.startsWith('/dept-head/complaints')) return 'Department Complaints';
  if (pathname.startsWith('/dept-head/team')) return 'Team Operations';
  if (pathname.startsWith('/dept-head/ai-suggestions')) return 'AI Resolution Intelligence';
  if (pathname === '/officer') return 'Officer Dashboard';
  if (pathname.startsWith('/officer/complaints')) return 'Assigned Complaints';
  if (pathname === '/field-worker') return 'Field Worker Tasks';
  return 'Dashboard Overview';
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
        'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 group select-none',
        indent ? 'ml-3 pl-3.5 border-l border-[#E5E2D9]' : '',
        isActive
          ? 'bg-[#C9DFDC] text-[#131E20] font-bold shadow-xs'
          : 'text-[#6E6B64] hover:bg-[#F2EFE6] hover:text-[#131E20]',
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'w-4 h-4 shrink-0 transition-colors',
            isActive ? 'text-[#131E20]' : 'text-[#6E6B64] group-hover:text-[#131E20]',
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
          'w-full flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 group select-none',
          isGroupActive
            ? 'bg-[#C9DFDC]/60 text-[#131E20] font-bold'
            : 'text-[#6E6B64] hover:bg-[#F2EFE6] hover:text-[#131E20]',
        )}
      >
        <Icon
          className={cn(
            'w-4 h-4 shrink-0 transition-colors',
            isGroupActive ? 'text-[#131E20]' : 'text-[#6E6B64] group-hover:text-[#131E20]',
          )}
        />
        <span className="flex-1 text-left truncate">{item.title}</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#6E6B64]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#6E6B64]" />
        )}
      </button>

      {open && (
        <div className="mt-1 space-y-1">
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
    <div className="flex flex-col h-full bg-white border-r border-[#E5E2D9]">
      {/* Top Brand Card */}
      <div className="p-4 border-b border-[#E5E2D9]">
        <Link
          href="/"
          className="flex items-center gap-3 p-3 rounded-2xl border border-[#E5E2D9] bg-white hover:bg-[#F2EFE6]/50 transition-all shadow-xs group"
          onClick={onLinkClick}
        >
          <div className="w-10 h-10 rounded-full bg-[#3468A1] flex items-center justify-center shrink-0 shadow-xs text-white">
            {platformInfo.logoUrl ? (
              <Image
                src={platformInfo.logoUrl}
                alt={platformInfo.platformName}
                width={26}
                height={26}
                className="w-6 h-6 object-contain rounded-full"
              />
            ) : (
              <Shield className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[#131E20] font-bold text-sm leading-tight tracking-wide truncate">
              {platformInfo.platformName}
            </div>
            <div className="text-[#6E6B64] text-[10px] font-semibold tracking-wider uppercase leading-tight mt-0.5 truncate">
              Civic Intelligence
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4 scrollbar-thin">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.label && (
              <div className="px-3 pb-1.5 pt-1 text-[10px] font-bold tracking-widest text-[#6E6B64] uppercase">
                {section.label}
              </div>
            )}
            <div className="space-y-1">
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

      {/* Bottom User Card */}
      <div className="border-t border-[#E5E2D9] p-3 space-y-2">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#E5E2D9] shadow-xs">
          <div className="w-9 h-9 rounded-full bg-[#3468A1] flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-xs overflow-hidden">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name || 'Avatar'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              (user.name || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-[#131E20] truncate">
              {user.name || 'User'}
            </div>
            <div className="text-[11px] text-[#6E6B64] truncate">
              {user.email || `${(user.name || 'user').toLowerCase().replace(/\s+/g, '')}@city.gov`}
            </div>
          </div>
          <Link
            href={user.role === 'CITIZEN' ? '/citizen/profile' : '/admin/settings'}
            className="p-1.5 rounded-full text-[#6E6B64] hover:text-[#131E20] hover:bg-[#F2EFE6] transition-colors shrink-0"
            title="Settings"
            onClick={onLinkClick}
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>

        {/* View Citizen Portal */}
        {isAdminRole(user.role) && (
          <Link
            href="/citizen"
            target="_blank"
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#6E6B64] hover:text-[#131E20] hover:bg-[#F2EFE6] rounded-2xl transition-colors w-full"
            onClick={onLinkClick}
          >
            <Globe className="w-4 h-4 text-[#3468A1] shrink-0" />
            <span>View Citizen Portal</span>
          </Link>
        )}

        {/* Sign Out */}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-2xl transition-colors w-full"
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

  const [unreadCount, setUnreadCount] = React.useState(0);

  // Fetch real avatarUrl & profile completion status from /api/auth/me
  React.useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.user) {
          if (data.user.avatarUrl !== undefined) {
            setSelfAvatarUrl(data.user.avatarUrl);
          } else {
            setSelfAvatarUrl(null);
          }

          // C3: Block incomplete profile citizens from accessing other citizen pages
          if (
            data.user.role === 'CITIZEN' &&
            data.user.isProfileComplete === false &&
            pathname.startsWith('/citizen') &&
            pathname !== '/citizen/profile'
          ) {
            router.push('/citizen/profile?complete=required');
          }
        }
      })
      .catch(() => setSelfAvatarUrl(null));
  }, [pathname, router]);

  // B4: Notification Polling every 30 seconds
  React.useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications', {
          headers: { 'x-skip-global-error': 'true' },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const unread = data.filter((n: any) => !n.isRead).length;
            setUnreadCount(unread);
          }
        }
      } catch (err) {}
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Merge: prefer page-supplied non-empty avatarUrl, then self-fetched, then null
  const effectiveAvatarUrl =
    user.avatarUrl && typeof user.avatarUrl === 'string' && user.avatarUrl.trim()
      ? user.avatarUrl
      : selfAvatarUrl && typeof selfAvatarUrl === 'string' && selfAvatarUrl.trim()
        ? selfAvatarUrl
        : null;

  const effectiveUser = { ...user, avatarUrl: effectiveAvatarUrl };

  const handleLogout = async () => {
    if (user.role === 'CITIZEN' && typeof window !== 'undefined') {
      try {
        const { getDrafts } = await import('@/lib/offline-queue');
        const drafts = await getDrafts();
        const pending = drafts.filter((d) => d.status === 'pending' || d.status === 'syncing');
        if (pending.length > 0) {
          const confirmLogout = window.confirm(
            `You have ${pending.length} unsynced offline complaint(s). They will remain saved on this device, but won't be submitted until you log in again. Proceed with logout?`,
          );
          if (!confirmLogout) return;
        }
      } catch (e) {}
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login/citizen';
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F2EFE6]">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex lg:w-[300px] lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-30 shadow-xs">
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
          <div className="relative w-[300px] max-w-[85vw] h-full shadow-2xl overflow-hidden">
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
      <div className="flex-1 min-w-0 flex flex-col lg:pl-[300px]">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-[#E5E2D9] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 min-w-0 shadow-xs">
          {/* Left: hamburger + eyebrow + bold page title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Mobile menu toggle */}
            <button
              type="button"
              className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[#131E20] hover:bg-[#F2EFE6] transition-colors shrink-0 border border-[#E5E2D9]"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Eyebrow + Page Title */}
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#6E6B64] leading-tight truncate">
                {platformInfo.platformName} &bull; {getRoleLabel(effectiveUser.role)} Portal
              </div>
              <div className="text-sm sm:text-base font-extrabold text-[#131E20] leading-tight truncate mt-0.5">
                {getPageTitle(pathname, effectiveUser.role)}
              </div>
            </div>
          </div>

          {/* Right side header actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notifications bell */}
            {(() => {
              const notifHref = getNotificationHref(effectiveUser.role);
              if (!notifHref) return null;
              return (
                <Link
                  href={notifHref}
                  className="relative inline-flex h-11 w-11 md:h-10 md:w-10 items-center justify-center rounded-full border border-[#E5E2D9] text-[#6E6B64] hover:text-[#131E20] hover:bg-[#F2EFE6] transition-colors shrink-0"
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 md:top-1.5 md:right-1.5 flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                  )}
                </Link>
              );
            })()}

            {/* Logout Pill (visible on desktop md and up; drawer & profile on mobile) */}
            <button
              type="button"
              onClick={handleLogout}
              className="hidden md:inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-full border border-[#E5E2D9] bg-white text-xs font-semibold text-[#6E6B64] hover:text-[#131E20] hover:bg-[#F2EFE6] transition-colors shadow-2xs shrink-0"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Logout</span>
            </button>

            {/* Round Profile Button */}
            <Link
              href={effectiveUser.role === 'CITIZEN' ? '/citizen/profile' : '/admin/settings'}
              className="w-11 h-11 md:w-10 md:h-10 rounded-full border border-[#E5E2D9] bg-[#C9DFDC] flex items-center justify-center text-[#131E20] font-bold text-xs shrink-0 shadow-2xs overflow-hidden hover:opacity-90 transition-opacity"
              aria-label="Account Profile"
              title="Account Profile"
            >
              {effectiveUser.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={effectiveUser.avatarUrl} alt={effectiveUser.name || 'Avatar'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                (effectiveUser.name || 'U').charAt(0).toUpperCase()
              )}
            </Link>
          </div>
        </header>
        <OfflineBanner />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden bg-[#F2EFE6]">
          {children}
        </main>
      </div>
    </div>
  );
}
