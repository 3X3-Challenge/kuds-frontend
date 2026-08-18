import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, getToken, onUnauthorized, setToken } from "./api";
import type { AdminRole, AdminUser, LoginResponse } from "./types";

/** viewer ⊂ editor ⊂ publisher — giống ROLE_RANK bên admin.middleware.ts. */
const ROLE_RANK: Record<AdminRole, number> = { viewer: 0, editor: 1, publisher: 2 };

interface AuthValue {
  admin: AdminUser | null;
  /** true trong lúc kiểm token đang lưu; đừng vẽ trang đăng nhập trước khi xong. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /**
   * Có đủ quyền không. Dùng để ẩn nút, KHÔNG phải để bảo vệ dữ liệu — backend
   * mới là nơi chặn thật; ở đây chỉ để không mời người ta bấm một nút chắc chắn
   * trả về 403.
   */
  can: (minRole: AdminRole) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get<AdminUser>("/admin/auth/me")
      .then((me) => {
        if (!cancelled) setAdmin(me);
      })
      .catch(() => {
        setToken(null);
        if (!cancelled) setAdmin(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Bất kỳ request nào gặp 401 cũng có nghĩa token 8h đã hết hạn (admin không có
  // refresh token). Xoá hồ sơ ở đây là đủ để router đá về trang đăng nhập.
  useEffect(() => onUnauthorized(() => setAdmin(null)), []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResponse>("/admin/auth/login", { email, password });
    setToken(result.token);
    setAdmin(result.admin);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      admin,
      loading,
      login,
      logout,
      can: (minRole) => (admin ? ROLE_RANK[admin.role] >= ROLE_RANK[minRole] : false),
    }),
    [admin, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth phải nằm trong <AuthProvider>");
  return value;
}
