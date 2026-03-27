'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { isAuthenticated, isHydrated, accessToken, user } = useAuthStore();
  const { connectSocket, disconnectSocket, socketConnected } = useChatStore();

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated || !accessToken) {
      router.replace('/login');
    }
  }, [isAuthenticated, isHydrated, accessToken, router]);

  // ── Connect chat socket when authenticated ──────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    if (!socketConnected) {
      connectSocket(accessToken);
    }

    return () => {
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  // ── Loading state while hydrating from localStorage ─────────────────────────
  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          {/* Animated logo */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg animate-pulse-soft">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="currentColor"
              />
            </svg>
          </div>

          {/* Spinner */}
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin text-primary"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Redirect state (unauthenticated) ────────────────────────────────────────
  if (!isAuthenticated || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 animate-spin text-primary"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm text-muted-foreground">
            Redirecting to login…
          </span>
        </div>
      </div>
    );
  }

  // ── Authenticated layout ────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <Sidebar />

      {/* ── Main column (navbar + content) ──────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top navigation bar */}
        <Navbar />

        {/* Scrollable page content */}
        <main
          id="main-content"
          className={cn(
            'flex-1 overflow-y-auto',
            'bg-background',
            // Subtle inner shadow to indicate scrollable area
            'shadow-inner',
          )}
          tabIndex={-1}
          aria-label="Main content"
        >
          {/* Content wrapper with consistent padding */}
          <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
