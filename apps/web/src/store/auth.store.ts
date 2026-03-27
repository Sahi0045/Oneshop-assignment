import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { User } from '@freelancer/shared';

// ─── State shape ──────────────────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isHydrated: boolean;
}

// ─── Actions shape ────────────────────────────────────────────────────────────

export interface AuthActions {
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  updateUser: (partial: Partial<User>) => void;
  clearTokens: () => void;
}

export type AuthStore = AuthState & AuthActions;

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isAuthenticated: false,
  isHydrated: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state ──
        ...initialState,

        // ── Actions ──

        setUser: (user) =>
          set(
            { user, isAuthenticated: true },
            false,
            'auth/setUser',
          ),

        setTokens: (accessToken, refreshToken) =>
          set(
            { accessToken, refreshToken },
            false,
            'auth/setTokens',
          ),

        setAuth: (user, accessToken, refreshToken) =>
          set(
            {
              user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            },
            false,
            'auth/setAuth',
          ),

        logout: () =>
          set(
            {
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            },
            false,
            'auth/logout',
          ),

        setLoading: (loading) =>
          set({ isLoading: loading }, false, 'auth/setLoading'),

        setHydrated: (hydrated) =>
          set({ isHydrated: hydrated }, false, 'auth/setHydrated'),

        updateUser: (partial) => {
          const current = get().user;
          if (!current) return;
          set(
            { user: { ...current, ...partial } },
            false,
            'auth/updateUser',
          );
        },

        clearTokens: () =>
          set(
            { accessToken: null, refreshToken: null },
            false,
            'auth/clearTokens',
          ),
      }),
      {
        name: 'freelancer-auth',
        storage: createJSONStorage(() => {
          // Safe storage accessor — avoids SSR crashes
          if (typeof window === 'undefined') {
            return {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            };
          }
          return localStorage;
        }),
        // Only persist the fields we need across sessions
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated,
        }),
        // Called when hydration from storage is complete
        onRehydrateStorage: () => (state) => {
          if (state) {
            state.setHydrated(true);
            // Validate the persisted state — if there's no token, clear auth
            if (!state.accessToken) {
              state.logout();
            }
          }
        },
        version: 1,
        migrate: (persistedState, version) => {
          // Future migrations can go here
          if (version === 0) {
            // v0 → v1: no structural changes needed
            return persistedState as AuthStore;
          }
          return persistedState as AuthStore;
        },
      },
    ),
    {
      name: 'AuthStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// ─── Selectors (avoids unnecessary re-renders) ────────────────────────────────

export const selectUser = (state: AuthStore) => state.user;
export const selectAccessToken = (state: AuthStore) => state.accessToken;
export const selectRefreshToken = (state: AuthStore) => state.refreshToken;
export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectIsLoading = (state: AuthStore) => state.isLoading;
export const selectIsHydrated = (state: AuthStore) => state.isHydrated;
export const selectUserRole = (state: AuthStore) => state.user?.role ?? null;
export const selectUserId = (state: AuthStore) => state.user?.id ?? null;
export const selectUserFullName = (state: AuthStore) =>
  state.user ? `${state.user.firstName} ${state.user.lastName}` : null;
