import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, token) => {
        localStorage.setItem('admin_token', token);
        set({ user, accessToken: token });
      },
      logout: () => {
        localStorage.removeItem('admin_token');
        set({ user: null, accessToken: null });
      },
    }),
    {
      name: 'admin-auth-storage',
    }
  )
);
