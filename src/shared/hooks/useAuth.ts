import { invoke } from "@tauri-apps/api/core";
import { useAuthStore, type UserInfo } from "@store/auth-store";

export function useAuth() {
  const { user, isAuthenticated, setUser, logout: clearState } = useAuthStore();

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
    // Refresh user info after password change
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
