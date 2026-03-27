'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Gavel,
  HandshakeIcon,
  MessageSquare,
  Settings,
  PlusCircle,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  User,
  Bell,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore, selectTotalUnreadCount } from '@/store/chat.store';
import { useUiStore } from '@/store/ui.store';
import { useAuth } from '@/hooks/use-auth';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeVariant?: 'default' | 'destructive';
  roles?: ('CLIENT' | 'FREELANCER' | 'ADMIN')[];
  exact?: boolean;
}

// ─── Navigation config ────────────────────────────────────────────────────────

function useNavItems(unreadMessages: number): NavItem[] {
  return [
    {
      href: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: '/projects',
      label: 'Browse Projects',
      icon: Search,
      roles: ['FREELANCER'],
    },
    {
      href: '/projects',
      label: 'My Projects',
      icon: FolderOpen,
      roles: ['CLIENT'],
    },
    {
      href: '/projects/new',
      label: 'Post a Project',
      icon: PlusCircle,
      roles: ['CLIENT'],
    },
    {
      href: '/bids',
      label: 'My Bids',
      icon: Gavel,
      roles: ['FREELANCER'],
    },
    {
      href: '/contracts',
      label: 'Contracts',
      icon: HandshakeIcon,
    },
    {
      href: '/messages',
      label: 'Messages',
      icon: MessageSquare,
      badge: unreadMessages > 0 ? unreadMessages : undefined,
      badgeVariant: 'destructive',
    },
    {
      href: '/analytics',
      label: 'Analytics',
      icon: TrendingUp,
      roles: ['CLIENT', 'FREELANCER'],
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ];
}

// ─── NavLink component ────────────────────────────────────────────────────────

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick?: () => void;
}

function NavLink({ item, isActive, isCollapsed, onClick }: NavLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'sidebar-nav-item group relative',
        isActive && 'active',
        isCollapsed && 'justify-center px-2',
      )}
      aria-current={isActive ? 'page' : undefined}
      title={isCollapsed ? item.label : undefined}
    >
      {/* Icon */}
      <Icon
        className={cn(
          'h-5 w-5 shrink-0 transition-colors',
          isActive
            ? 'text-primary'
            : 'text-muted-foreground group-hover:text-foreground',
        )}
      />

      {/* Label */}
      {!isCollapsed && (
        <span className="flex-1 truncate text-sm">{item.label}</span>
      )}

      {/* Badge */}
      {item.badge !== undefined && item.badge > 0 && (
        <span
          className={cn(
            'inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1',
            'text-[10px] font-bold tabular-nums',
            item.badgeVariant === 'destructive'
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-primary text-primary-foreground',
            isCollapsed && 'absolute -right-1 -top-1 min-w-4 h-4',
          )}
          aria-label={`${item.badge} unread`}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}

      {/* Active indicator bar */}
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { logoutMutation } = useAuth();
  const unreadMessages = useChatStore(selectTotalUnreadCount);

  const {
    isSidebarOpen,
    isSidebarCollapsed,
    setSidebarOpen,
    toggleSidebarCollapsed,
  } = useUiStore();

  const navItems = useNavItems(unreadMessages);

  // Filter items based on user role
  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!user?.role) return false;
    return item.roles.includes(user.role as 'CLIENT' | 'FREELANCER' | 'ADMIN');
  });

  // Determine active route
  function isNavItemActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close mobile sidebar on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isSidebarOpen) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen, setSidebarOpen]);

  const sidebarContent = (
    <aside
      className={cn(
        'flex h-full flex-col bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]',
        'transition-[width] duration-300 ease-in-out',
        isSidebarCollapsed ? 'w-16' : 'w-64',
      )}
      aria-label="Main navigation"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-[hsl(var(--sidebar-border))] px-4',
          isSidebarCollapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!isSidebarCollapsed && (
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
            aria-label="FreelancerHub — go to dashboard"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm group-hover:shadow-primary-glow transition-shadow">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-[hsl(var(--sidebar-foreground))]">
              Freelancer<span className="text-primary">Hub</span>
            </span>
          </Link>
        )}

        {isSidebarCollapsed && (
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm hover:shadow-primary-glow transition-shadow"
            aria-label="FreelancerHub — go to dashboard"
          >
            <Zap className="h-4 w-4" />
          </Link>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          className={cn(
            'hidden lg:flex h-7 w-7 items-center justify-center rounded-md',
            'text-[hsl(var(--sidebar-foreground))]/50 hover:text-[hsl(var(--sidebar-foreground))]',
            'hover:bg-[hsl(var(--sidebar-accent))] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isSidebarCollapsed && 'absolute right-0 translate-x-1/2 bg-background border border-border shadow-sm hover:bg-accent z-10',
          )}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={isSidebarCollapsed}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5 scrollbar-hide" aria-label="Sidebar navigation">
        {/* Section: Main */}
        {!isSidebarCollapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground))]/40">
            Main
          </p>
        )}

        {visibleNavItems.slice(0, 1).map((item) => (
          <NavLink
            key={item.href + item.label}
            item={item}
            isActive={isNavItemActive(item)}
            isCollapsed={isSidebarCollapsed}
            onClick={() => setSidebarOpen(false)}
          />
        ))}

        {/* Section: Projects & Work */}
        {!isSidebarCollapsed && (
          <p className="mt-4 mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground))]/40">
            {user?.role === 'CLIENT' ? 'Projects' : 'Work'}
          </p>
        )}

        {isSidebarCollapsed && (
          <div className="my-2 mx-2 h-px bg-[hsl(var(--sidebar-border))]" />
        )}

        {visibleNavItems.slice(1, -2).map((item) => (
          <NavLink
            key={item.href + item.label}
            item={item}
            isActive={isNavItemActive(item)}
            isCollapsed={isSidebarCollapsed}
            onClick={() => setSidebarOpen(false)}
          />
        ))}

        {/* Section: Account */}
        {!isSidebarCollapsed && (
          <p className="mt-4 mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground))]/40">
            Account
          </p>
        )}

        {isSidebarCollapsed && (
          <div className="my-2 mx-2 h-px bg-[hsl(var(--sidebar-border))]" />
        )}

        {visibleNavItems.slice(-2).map((item) => (
          <NavLink
            key={item.href + item.label}
            item={item}
            isActive={isNavItemActive(item)}
            isCollapsed={isSidebarCollapsed}
            onClick={() => setSidebarOpen(false)}
          />
        ))}
      </nav>

      {/* ── User info footer ────────────────────────────────────────────── */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
        {user ? (
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg',
              isSidebarCollapsed ? 'flex-col justify-center' : '',
            )}
          >
            {/* Avatar */}
            <UserAvatar
              src={user.avatar}
              firstName={user.firstName}
              lastName={user.lastName}
              size="sm"
              isVerified={user.isVerified}
              className="shrink-0"
            />

            {/* Name + role */}
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-[hsl(var(--sidebar-foreground))]">
                  {user.firstName} {user.lastName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant={
                      user.role === 'CLIENT'
                        ? 'client'
                        : user.role === 'FREELANCER'
                        ? 'freelancer'
                        : 'admin'
                    }
                    size="sm"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {user.role}
                  </Badge>
                  {user.isVerified && (
                    <span className="text-[10px] text-blue-500 font-medium">
                      ✓ Verified
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href="/settings"
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md',
                    'text-[hsl(var(--sidebar-foreground))]/50 hover:text-[hsl(var(--sidebar-foreground))]',
                    'hover:bg-[hsl(var(--sidebar-accent))] transition-colors',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  aria-label="Go to settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md',
                    'text-[hsl(var(--sidebar-foreground))]/50 hover:text-destructive',
                    'hover:bg-destructive/10 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    'disabled:pointer-events-none disabled:opacity-50',
                  )}
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Collapsed: show only logout */}
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md',
                  'text-[hsl(var(--sidebar-foreground))]/50 hover:text-destructive',
                  'hover:bg-destructive/10 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-50',
                )}
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          /* Skeleton fallback while user loads */
          <div
            className={cn(
              'flex items-center gap-3',
              isSidebarCollapsed && 'justify-center',
            )}
          >
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
            {!isSidebarCollapsed && (
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
                <div className="h-3 w-16 rounded bg-muted animate-pulse" />
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Mobile overlay ──────────────────────────────────────────────── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden',
          'transition-transform duration-300 ease-in-out',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className={cn(
            'absolute -right-10 top-4',
            'flex h-8 w-8 items-center justify-center rounded-md',
            'bg-background border border-border text-muted-foreground',
            'hover:text-foreground transition-colors shadow-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label="Close navigation menu"
        >
          <X className="h-4 w-4" />
        </button>

        {sidebarContent}
      </div>

      {/* ── Desktop static sidebar ──────────────────────────────────────── */}
      <div className="relative hidden lg:flex lg:flex-col lg:flex-shrink-0">
        {sidebarContent}
      </div>
    </>
  );
}
