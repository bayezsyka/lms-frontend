// src/context/AuthContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  apiGet,
  apiPost,
  clearAuthToken,
  getAuthToken,
  setAuthToken,
  type ApiError,
} from "../lib/apiClient";

export type UserRole = "superadmin" | "dosen" | "mahasiswa";

export type UserStatus = "active" | "inactive";

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  username: string;
  nim: string | null;
  role: UserRole;
  status: UserStatus;
  force_password_change: boolean;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Inisialisasi: cek token di localStorage, lalu hit /api/auth/me
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const existingToken = getAuthToken();
      if (!existingToken) {
        if (isMounted) {
          setInitialized(true);
        }
        return;
      }

      setToken(existingToken);
      setLoading(true);

      try {
        const me = await apiGet<AuthUser>("/api/auth/me");
        if (isMounted) {
          setUser(me);
        }
      } catch {
        // token invalid → bersihkan
        clearAuthToken();
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    }

    void initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(username: string, password: string): Promise<void> {
    setLoading(true);
    try {
      const res = await apiPost<LoginResponse>(
        "/api/auth/login",
        { username, password },
        { withAuth: false }
      );

      setAuthToken(res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (error: unknown) {
      // lempar lagi dengan pesan lebih rapi
      let message = "Login gagal.";

      if (error instanceof Error) {
        message = error.message;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "data" in error
      ) {
        const err = error as ApiError;
        if (
          err.data &&
          typeof err.data === "object" &&
          "message" in err.data &&
          typeof (err.data as { message?: unknown }).message === "string"
        ) {
          message = (err.data as { message?: string }).message ?? message;
        }
      }

      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  async function logout(): Promise<void> {
    setLoading(true);
    try {
      await apiPost<unknown>("/api/auth/logout");
    } catch {
      // kalau gagal tetap kita clear lokalnya
    } finally {
      clearAuthToken();
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  }

  async function refreshUser(): Promise<void> {
    if (!token) return;

    setLoading(true);
    try {
      const me = await apiGet<AuthUser>("/api/auth/me");
      setUser(me);
    } finally {
      setLoading(false);
    }
  }

  const value: AuthContextValue = {
    user,
    token,
    loading,
    initialized,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
