'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import type {
  LoginInput,
  RegisterInput,
  User,
  AuthTokens,
} from '@freelancer/shared';

// ─── Response shapes ──────────────────────────────────────────────────────────

interface AuthResponseData {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface ApiAuthResponse {
  success: boolean;
  message: string;
  data: AuthResponseData;
}

interface RefreshResponseData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface ApiRefreshResponse {
  success: boolean;
  message: string;
  data: RefreshResponseData;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    isLoading,
    setAuth,
    setUser,
    setTokens,
    logout: storeLogout,
    setLoading,
    updateUser,
  } = useAuthStore();

  const { reset: resetChat } = useChatStore();

  // ── Login ──────────────────────────────────────────────────────────────────

  const loginMutation = useMutation<ApiAuthResponse, Error, LoginInput>({
    mutationFn: async (credentials: LoginInput) => {
      const response = await api.post<ApiAuthResponse>('/auth/login', credentials);
      return response.data;
    },
    onMutate: () => {
      setLoading(true);
    },
    onSuccess: (response) => {
      const { user: loggedInUser, accessToken: token, refreshToken: refresh } =
        response.data;

      setAuth(loggedInUser, token, refresh);

      // Set cookie for middleware-level auth checks
      if (typeof document !== 'undefined') {
        document.cookie = `accessToken=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      // Clear any stale query cache from previous sessions
      queryClient.clear();

      router.push('/dashboard');
      router.refresh();
    },
    onError: () => {
      setLoading(false);
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  // ── Register ───────────────────────────────────────────────────────────────

  const registerMutation = useMutation<ApiAuthResponse, Error, RegisterInput>({
    mutationFn: async (data: RegisterInput) => {
      const response = await api.post<ApiAuthResponse>('/auth/register', data);
      return response.data;
    },
    onMutate: () => {
      setLoading(true);
    },
    onSuccess: (response) => {
      const { user: newUser, accessToken: token, refreshToken: refresh } =
        response.data;

      setAuth(newUser, token, refresh);

      // Set cookie for middleware-level auth checks
      if (typeof document !== 'undefined') {
        document.cookie = `accessToken=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      queryClient.clear();

      router.push('/dashboard');
      router.refresh();
    },
    onError: () => {
      setLoading(false);
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      // Attempt server-side logout (invalidate refresh token).
      // We fire-and-forget — even if the request fails we still clear local state.
      try {
        if (refreshToken) {
          await api.post('/auth/logout', { refreshToken });
        }
      } catch {
        // Intentionally ignored — local logout proceeds regardless
      }
    },
    onMutate: () => {
      setLoading(true);
    },
    onSettled: () => {
      // Always clear local state on logout
      storeLogout();
      resetChat();
      queryClient.clear();

      // Remove the auth cookie
      if (typeof document !== 'undefined') {
        document.cookie =
          'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      }

      router.push('/login');
      router.refresh();
    },
  });

  // ── Refresh token ──────────────────────────────────────────────────────────

  const refreshTokenMutation = useMutation<
    ApiRefreshResponse,
    Error,
    { refreshToken: string }
  >({
    mutationFn: async ({ refreshToken: token }) => {
      const response = await api.post<ApiRefreshResponse>('/auth/refresh', {
        refreshToken: token,
      });
      return response.data;
    },
    onSuccess: (response) => {
      const { accessToken: newAccess, refreshToken: newRefresh } = response.data;
      setTokens(newAccess, newRefresh);

      if (typeof document !== 'undefined') {
        document.cookie = `accessToken=${newAccess}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }
    },
    onError: () => {
      // If refresh fails, force logout
      storeLogout();
      resetChat();
      queryClient.clear();

      if (typeof document !== 'undefined') {
        document.cookie =
          'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      }

      router.push('/login');
    },
  });

  // ── Update profile (optimistic) ────────────────────────────────────────────

  const updateProfileMutation = useMutation<
    { success: boolean; message: string; data: User },
    Error,
    Partial<User>
  >({
    mutationFn: async (updates) => {
      const response = await api.patch<{
        success: boolean;
        message: string;
        data: User;
      }>('/users/me', updates);
      return response.data;
    },
    onMutate: (updates) => {
      // Optimistic update
      updateUser(updates);
    },
    onSuccess: (response) => {
      setUser(response.data);
      // Invalidate user-related queries
      void queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
    onError: () => {
      // Roll back by re-fetching current user
      void queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
  });

  // ── Social auth helper ─────────────────────────────────────────────────────

  /**
   * Redirects the browser to the OAuth provider login URL.
   * The backend handles the OAuth flow and redirects back with tokens.
   */
  const socialLogin = (provider: 'google' | 'github') => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const callbackUrl = encodeURIComponent(
      `${window.location.origin}/auth/callback`,
    );
    window.location.href = `${apiUrl}/auth/${provider}?redirectUrl=${callbackUrl}`;
  };

  // ── Derived helpers ────────────────────────────────────────────────────────

  const isClient = user?.role === 'CLIENT';
  const isFreelancer = user?.role === 'FREELANCER';
  const isAdmin = user?.role === 'ADMIN';

  const userFullName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : null;

  const userInitials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : null;

  return {
    // State
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    isLoading,

    // Derived
    isClient,
    isFreelancer,
    isAdmin,
    userFullName,
    userInitials,

    // Mutations
    loginMutation,
    registerMutation,
    logoutMutation,
    refreshTokenMutation,
    updateProfileMutation,

    // Helpers
    socialLogin,

    // Convenience boolean flags from mutations
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}

// ─── Type export for consumers ────────────────────────────────────────────────

export type UseAuthReturn = ReturnType<typeof useAuth>;
