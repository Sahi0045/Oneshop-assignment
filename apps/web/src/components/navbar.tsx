'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Search,
  Menu,
  X,
  Settings,
  LogOut,
  User,
  Zap,
  ChevronDown,
  Check,
  Briefcase,
  MessageSquare,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useAuth } from '@/hooks/use-auth';
import { cn, getInitials, formatRelativeTime } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/avatar';
import type { Notification } from '@freelancer/shared';

// ─── Notification item ────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
}

function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const typeIconMap: Record<string, React.ReactNode> = {
    BID_RECEIVED: <Briefcase className="h-4 w-4 text-blue-500" />,
    BID_ACCEPTED: <Check className="h-4 w-4 text-green-500" />,
    MESSAGE_RECEIVED: <MessageSquare className="h-4 w-4 text-violet-500" />,
  };

  const icon = typeIconMap[notification.type] ?? (
    <Bell className="h-4 w-4 text-muted-foreground" />
  );

  return (
    <button
      type="button"
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left',
        'transition-colors hover:bg-accent',
        !notification.isRead && 'bg-primary/5',
      )}
      onClick={() => onRead(notification.id)}
    >
      {/* Icon */}
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p
          className={cn(
            'text-sm leading-snug',
            notification.isRead
              ? 'text-muted-foreground'
              : 'text-foreground font-medium',
          )}
        >
          {notification.title}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {notification.body}
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.isRead && (
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
          aria-label="Unread"
        />
      )}
    </button>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export function Navbar() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { logoutMutation } = useAuth();

  const {
    toggleSidebar,
    isSidebarOpen,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useUiStore();

  // Dropdown state
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Refs for click-outside detection
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setIsUserOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsNotifOpen(false);
        setIsUserOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard/projects?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleLogout = () => {
    setIsUserOpen(false);
    logoutMutation.mutate();
  };

  const handleMarkRead = (id: string) => {
    markNotificationRead(id);
  };

  const userFullName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : 'User';

  const userInitials = user
    ? getInitials(user.firstName, user.lastName)
    : '?';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background/95 backdrop-blur-sm px-4 gap-4">
      {/* ── Left: hamburger + logo ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Sidebar toggle */}
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md',
            'text-muted-foreground hover:text-foreground hover:bg-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'transition-colors',
          )}
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={isSidebarOpen}
        >
          {isSidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>

        {/* Logo (visible on mobile when sidebar is closed) */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 lg:hidden"
          aria-label="FreelancerHub dashboard"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <span className="text-base font-bold tracking-tight hidden sm:block">
            Freelancer<span className="text-primary">Hub</span>
          </span>
        </Link>
      </div>

      {/* ── Center: search ──────────────────────────────────────────────── */}
      <form
        onSubmit={handleSearch}
        className="hidden md:flex flex-1 max-w-md"
        role="search"
        aria-label="Search projects"
      >
        <div
          className={cn(
            'relative flex w-full items-center rounded-lg border transition-all duration-150',
            isSearchFocused
              ? 'border-primary ring-2 ring-ring ring-offset-1 ring-offset-background'
              : 'border-input hover:border-muted-foreground/40',
            'bg-background',
          )}
        >
          <Search
            className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search projects, freelancers…"
            className={cn(
              'h-9 w-full rounded-lg bg-transparent py-2 pl-9 pr-4 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none',
            )}
            aria-label="Search"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* ── Right: actions ──────────────────────────────────────────────── */}
      <div className="ml-auto flex items-center gap-2">
        {/* Mobile search icon */}
        <button
          type="button"
          className={cn(
            'md:hidden flex h-9 w-9 items-center justify-center rounded-md',
            'text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label="Search"
          onClick={() => router.push('/dashboard/projects')}
        >
          <Search className="h-4.5 w-4.5 h-5 w-5" />
        </button>

        {/* ── Notifications bell ─────────────────────────────────────── */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setIsNotifOpen((prev) => !prev);
              setIsUserOpen(false);
            }}
            className={cn(
              'relative flex h-9 w-9 items-center justify-center rounded-md',
              'text-muted-foreground hover:text-foreground hover:bg-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'transition-colors',
              isNotifOpen && 'bg-accent text-foreground',
            )}
            aria-label={`Notifications${unreadNotificationCount > 0 ? ` (${unreadNotificationCount} unread)` : ''}`}
            aria-haspopup="true"
            aria-expanded={isNotifOpen}
          >
            <Bell className="h-5 w-5" />
            {unreadNotificationCount > 0 && (
              <span
                className={cn(
                  'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center',
                  'rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground',
                  'ring-2 ring-background',
                )}
                aria-hidden="true"
              >
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {isNotifOpen && (
            <div
              className={cn(
                'absolute right-0 top-full mt-2 w-80 sm:w-96',
                'rounded-xl border border-border bg-background shadow-hard',
                'overflow-hidden z-50',
                'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150',
              )}
              role="dialog"
              aria-label="Notifications"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Notifications
                  </h2>
                  {unreadNotificationCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                      {unreadNotificationCount}
                    </span>
                  )}
                </div>
                {unreadNotificationCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-xs text-primary hover:underline underline-offset-4 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-[360px] overflow-y-auto scrollbar-styled">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Bell className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        All caught up!
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        No new notifications
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.slice(0, 10).map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRead={handleMarkRead}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="border-t border-border px-4 py-3">
                  <Link
                    href="/notifications"
                    onClick={() => setIsNotifOpen(false)}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-4"
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── User avatar dropdown ───────────────────────────────────── */}
        <div ref={userRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setIsUserOpen((prev) => !prev);
              setIsNotifOpen(false);
            }}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5',
              'hover:bg-accent transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isUserOpen && 'bg-accent',
            )}
            aria-label="User menu"
            aria-haspopup="true"
            aria-expanded={isUserOpen}
          >
            <UserAvatar
              src={user?.avatar}
              firstName={user?.firstName ?? ''}
              lastName={user?.lastName ?? ''}
              size="sm"
              isVerified={user?.isVerified}
            />
            <div className="hidden sm:block text-left">
              <p className="max-w-[120px] truncate text-xs font-semibold text-foreground leading-tight">
                {userFullName}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize leading-tight">
                {user?.role?.toLowerCase() ?? 'user'}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'hidden sm:block h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0',
                isUserOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>

          {/* User dropdown */}
          {isUserOpen && (
            <div
              className={cn(
                'absolute right-0 top-full mt-2 w-64',
                'rounded-xl border border-border bg-background shadow-hard',
                'overflow-hidden z-50',
                'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150',
              )}
              role="menu"
              aria-orientation="vertical"
            >
              {/* User info header */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-4">
                <UserAvatar
                  src={user?.avatar}
                  firstName={user?.firstName ?? ''}
                  lastName={user?.lastName ?? ''}
                  size="md"
                  isVerified={user?.isVerified}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {userFullName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.email}
                  </p>
                  <span
                    className={cn(
                      'mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      user?.role === 'CLIENT'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : user?.role === 'FREELANCER'
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
                    )}
                  >
                    {user?.role ?? 'USER'}
                  </span>
                </div>
              </div>

              {/* Menu items */}
              <nav className="p-1.5" role="none">
                <DropdownLink
                  href="/dashboard"
                  icon={<Zap className="h-4 w-4" />}
                  label="Dashboard"
                  onClick={() => setIsUserOpen(false)}
                />
                <DropdownLink
                  href="/settings"
                  icon={<User className="h-4 w-4" />}
                  label="My Profile"
                  onClick={() => setIsUserOpen(false)}
                />
                <DropdownLink
                  href="/settings"
                  icon={<Settings className="h-4 w-4" />}
                  label="Settings"
                  onClick={() => setIsUserOpen(false)}
                />
              </nav>

              {/* Divider */}
              <div className="h-px bg-border mx-1.5" />

              {/* Sign out */}
              <div className="p-1.5">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  role="menuitem"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
                    'text-destructive hover:bg-destructive/10',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:pointer-events-none disabled:opacity-50',
                    'transition-colors',
                  )}
                >
                  {logoutMutation.isPending ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin shrink-0"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Signing out…
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Sign out
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Dropdown link helper ─────────────────────────────────────────────────────

interface DropdownLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick?: () => void;
}

function DropdownLink({ href, icon, label, badge, onClick }: DropdownLinkProps) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
        'text-foreground hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'transition-colors',
      )}
    >
      <span className="shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
