import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { Notification } from '@freelancer/shared';

// ─── State shape ──────────────────────────────────────────────────────────────

interface UiState {
  // Sidebar
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;

  // Notifications
  notifications: Notification[];
  unreadNotificationCount: number;

  // Global loading / overlay
  isGlobalLoading: boolean;
  globalLoadingMessage: string | null;

  // Modal stack
  activeModal: string | null;
  modalProps: Record<string, unknown>;

  // Toast queue (lightweight internal queue; shadcn Toaster handles rendering)
  toastQueue: ToastItem[];

  // Search
  globalSearchQuery: string;
  isSearchOpen: boolean;

  // Theme
  theme: 'light' | 'dark' | 'system';

  // Mobile
  isMobileMenuOpen: boolean;
}

// ─── Supplementary types ──────────────────────────────────────────────────────

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
  createdAt: number;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface UiActions {
  // Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Notifications
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (notificationId: string) => void;
  setUnreadNotificationCount: (count: number) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;

  // Global loading
  setGlobalLoading: (loading: boolean, message?: string) => void;

  // Modals
  openModal: (modalId: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Toasts
  addToast: (toast: Omit<ToastItem, 'id' | 'createdAt'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // Search
  setGlobalSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;

  // Theme
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Mobile menu
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;

  // Reset
  reset: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: UiState = {
  isSidebarOpen: true,
  isSidebarCollapsed: false,
  notifications: [],
  unreadNotificationCount: 0,
  isGlobalLoading: false,
  globalLoadingMessage: null,
  activeModal: null,
  modalProps: {},
  toastQueue: [],
  globalSearchQuery: '',
  isSearchOpen: false,
  theme: 'system',
  isMobileMenuOpen: false,
};

// ─── ID generator ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUiStore = create<UiState & UiActions>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // ── Sidebar ─────────────────────────────────────────────────────────────

      toggleSidebar: () =>
        set(
          (state) => ({ isSidebarOpen: !state.isSidebarOpen }),
          false,
          'ui/toggleSidebar',
        ),

      setSidebarOpen: (open) =>
        set({ isSidebarOpen: open }, false, 'ui/setSidebarOpen'),

      toggleSidebarCollapsed: () =>
        set(
          (state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed }),
          false,
          'ui/toggleSidebarCollapsed',
        ),

      setSidebarCollapsed: (collapsed) =>
        set({ isSidebarCollapsed: collapsed }, false, 'ui/setSidebarCollapsed'),

      // ── Notifications ────────────────────────────────────────────────────────

      setNotifications: (notifications) =>
        set(
          {
            notifications,
            unreadNotificationCount: notifications.filter((n) => !n.isRead).length,
          },
          false,
          'ui/setNotifications',
        ),

      addNotification: (notification) =>
        set(
          (state) => {
            // Prevent duplicate notifications
            const exists = state.notifications.some((n) => n.id === notification.id);
            if (exists) return state;

            const updated = [notification, ...state.notifications].slice(0, 100); // Cap at 100
            const unreadCount = updated.filter((n) => !n.isRead).length;

            return {
              notifications: updated,
              unreadNotificationCount: unreadCount,
            };
          },
          false,
          'ui/addNotification',
        ),

      markNotificationRead: (notificationId) =>
        set(
          (state) => {
            const notifications = state.notifications.map((n) =>
              n.id === notificationId
                ? { ...n, isRead: true, readAt: new Date() }
                : n,
            );
            const unreadNotificationCount = notifications.filter((n) => !n.isRead).length;
            return { notifications, unreadNotificationCount };
          },
          false,
          'ui/markNotificationRead',
        ),

      markAllNotificationsRead: () =>
        set(
          (state) => ({
            notifications: state.notifications.map((n) => ({
              ...n,
              isRead: true,
              readAt: n.readAt ?? new Date(),
            })),
            unreadNotificationCount: 0,
          }),
          false,
          'ui/markAllNotificationsRead',
        ),

      removeNotification: (notificationId) =>
        set(
          (state) => {
            const notifications = state.notifications.filter(
              (n) => n.id !== notificationId,
            );
            const unreadNotificationCount = notifications.filter((n) => !n.isRead).length;
            return { notifications, unreadNotificationCount };
          },
          false,
          'ui/removeNotification',
        ),

      setUnreadNotificationCount: (count) =>
        set(
          { unreadNotificationCount: Math.max(0, count) },
          false,
          'ui/setUnreadNotificationCount',
        ),

      incrementUnreadCount: () =>
        set(
          (state) => ({
            unreadNotificationCount: state.unreadNotificationCount + 1,
          }),
          false,
          'ui/incrementUnreadCount',
        ),

      decrementUnreadCount: () =>
        set(
          (state) => ({
            unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1),
          }),
          false,
          'ui/decrementUnreadCount',
        ),

      // ── Global loading ───────────────────────────────────────────────────────

      setGlobalLoading: (loading, message) =>
        set(
          {
            isGlobalLoading: loading,
            globalLoadingMessage: loading ? (message ?? null) : null,
          },
          false,
          'ui/setGlobalLoading',
        ),

      // ── Modals ───────────────────────────────────────────────────────────────

      openModal: (modalId, props = {}) =>
        set(
          { activeModal: modalId, modalProps: props },
          false,
          'ui/openModal',
        ),

      closeModal: () =>
        set({ activeModal: null, modalProps: {} }, false, 'ui/closeModal'),

      // ── Toasts ───────────────────────────────────────────────────────────────

      addToast: (toast) => {
        const item: ToastItem = {
          ...toast,
          id: generateId(),
          createdAt: Date.now(),
        };

        set(
          (state) => ({
            toastQueue: [...state.toastQueue, item].slice(-10), // Max 10 toasts
          }),
          false,
          'ui/addToast',
        );

        // Auto-remove after duration (default 5 s)
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
          setTimeout(() => {
            get().removeToast(item.id);
          }, duration);
        }
      },

      removeToast: (id) =>
        set(
          (state) => ({
            toastQueue: state.toastQueue.filter((t) => t.id !== id),
          }),
          false,
          'ui/removeToast',
        ),

      clearToasts: () =>
        set({ toastQueue: [] }, false, 'ui/clearToasts'),

      // ── Search ───────────────────────────────────────────────────────────────

      setGlobalSearchQuery: (query) =>
        set({ globalSearchQuery: query }, false, 'ui/setGlobalSearchQuery'),

      setSearchOpen: (open) =>
        set({ isSearchOpen: open }, false, 'ui/setSearchOpen'),

      toggleSearch: () =>
        set(
          (state) => ({ isSearchOpen: !state.isSearchOpen }),
          false,
          'ui/toggleSearch',
        ),

      // ── Theme ────────────────────────────────────────────────────────────────

      setTheme: (theme) => {
        set({ theme }, false, 'ui/setTheme');

        // Apply theme to document
        if (typeof document !== 'undefined') {
          const root = document.documentElement;
          root.classList.remove('light', 'dark');

          if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.add(prefersDark ? 'dark' : 'light');
          } else {
            root.classList.add(theme);
          }

          // Persist preference
          try {
            localStorage.setItem('theme', theme);
          } catch {
            // Private browsing — ignore
          }
        }
      },

      // ── Mobile menu ──────────────────────────────────────────────────────────

      setMobileMenuOpen: (open) =>
        set({ isMobileMenuOpen: open }, false, 'ui/setMobileMenuOpen'),

      toggleMobileMenu: () =>
        set(
          (state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen }),
          false,
          'ui/toggleMobileMenu',
        ),

      // ── Reset ────────────────────────────────────────────────────────────────

      reset: () => set(initialState, false, 'ui/reset'),
    })),
    { name: 'FreelancerHub/UI', enabled: process.env.NODE_ENV === 'development' },
  ),
);

// ─── Selectors (memoised slices for perf) ─────────────────────────────────────

export const selectIsSidebarOpen = (s: UiState & UiActions) => s.isSidebarOpen;
export const selectIsSidebarCollapsed = (s: UiState & UiActions) => s.isSidebarCollapsed;
export const selectNotifications = (s: UiState & UiActions) => s.notifications;
export const selectUnreadCount = (s: UiState & UiActions) => s.unreadNotificationCount;
export const selectActiveModal = (s: UiState & UiActions) => s.activeModal;
export const selectModalProps = (s: UiState & UiActions) => s.modalProps;
export const selectToastQueue = (s: UiState & UiActions) => s.toastQueue;
export const selectIsGlobalLoading = (s: UiState & UiActions) => s.isGlobalLoading;
export const selectTheme = (s: UiState & UiActions) => s.theme;
export const selectIsSearchOpen = (s: UiState & UiActions) => s.isSearchOpen;
export const selectGlobalSearchQuery = (s: UiState & UiActions) => s.globalSearchQuery;
export const selectIsMobileMenuOpen = (s: UiState & UiActions) => s.isMobileMenuOpen;

// ─── Convenience hooks ────────────────────────────────────────────────────────

/** Returns sidebar state and toggle actions. */
export function useSidebar() {
  return useUiStore((s) => ({
    isOpen: s.isSidebarOpen,
    isCollapsed: s.isSidebarCollapsed,
    toggle: s.toggleSidebar,
    setOpen: s.setSidebarOpen,
    toggleCollapsed: s.toggleSidebarCollapsed,
    setCollapsed: s.setSidebarCollapsed,
  }));
}

/** Returns notification state and actions. */
export function useNotifications() {
  return useUiStore((s) => ({
    notifications: s.notifications,
    unreadCount: s.unreadNotificationCount,
    add: s.addNotification,
    markRead: s.markNotificationRead,
    markAllRead: s.markAllNotificationsRead,
    remove: s.removeNotification,
    set: s.setNotifications,
    setCount: s.setUnreadNotificationCount,
    increment: s.incrementUnreadCount,
    decrement: s.decrementUnreadCount,
  }));
}

/** Returns toast queue and actions. */
export function useToastQueue() {
  return useUiStore((s) => ({
    queue: s.toastQueue,
    add: s.addToast,
    remove: s.removeToast,
    clear: s.clearToasts,
  }));
}

/** Returns modal state and actions. */
export function useModal(modalId?: string) {
  return useUiStore((s) => ({
    isOpen: modalId ? s.activeModal === modalId : !!s.activeModal,
    activeModal: s.activeModal,
    props: s.modalProps,
    open: s.openModal,
    close: s.closeModal,
  }));
}
