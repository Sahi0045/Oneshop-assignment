'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

export function LandingRedirect({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    // Only redirect after hydration is complete
    if (isHydrated && isAuthenticated) {
      // User is logged in, redirect to dashboard
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isHydrated, router]);

  // Show landing page for unauthenticated users or while hydrating
  return <>{children}</>;
}
