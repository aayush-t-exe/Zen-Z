import { create } from 'zustand';

export interface AuthState {
  session: any | null;
  user: any | null;
  isLoading: boolean;
  error: string | null;
  setSession: (session: any) => void;
  setUser: (user: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  error: null,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
