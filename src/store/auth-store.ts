import { create } from "zustand";

export interface UserInfo {
  id: number;
  username: string;
  role: "master" | "doctor" | "auxiliary";
  display_name: string;
  must_change_password: boolean;
}

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  setUser: (user: UserInfo | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
