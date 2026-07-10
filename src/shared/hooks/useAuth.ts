import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore, type UserInfo } from "@store/auth-store";

const HEALTH_CHECK_INTERVAL = 30_000; // 30 seconds

export function useAuth() {
  const { user, isAuthenticated, setUser, logout: clearState } = useAuthStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Periodic health-check: verify session is still valid
  useEffect(() => {
    if (isAuthenticated) {
      intervalRef.current = setInterval(async () => {
        try {
          const currentUser = await invoke<UserInfo | null>("get_current_user");
          if (!currentUser) {
            // Session expired on backend (timeout or cleared)
            clearState();
          }
        } catch {
          // Backend unreachable or session invalid
          clearState();
        }
      }, HEALTH_CHECK_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated]);

  const login = async (username: string, password: string): Promise<UserInfo> => {
    const userInfo = await invoke<UserInfo>("login", { username, password });
    setUser(userInfo);
    return userInfo;
  };

  const logout = async () => {
    await invoke("logout");
    clearState();
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await invoke("change_password", { currentPassword, newPassword });
    const updated = await invoke<UserInfo | null>("get_current_user");
    if (updated) setUser(updated);
  };

  const checkSession = async () => {
    const currentUser = await invoke<UserInfo | null>("get_current_user");
    setUser(currentUser);
    return currentUser;
  };

  return {
    user,
    isAuthenticated,
    login,
    logout,
    changePassword,
    checkSession,
  };
}
