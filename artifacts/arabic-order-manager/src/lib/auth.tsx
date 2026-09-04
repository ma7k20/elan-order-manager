import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type AppAccount = {
  id: number;
  name: string;
  phone: string;
  canManageAccounts: boolean;
  active: boolean;
};

type AuthContextValue = {
  account: AppAccount | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: string };
    return data.error || "تعذر إكمال الطلب.";
  } catch {
    return "تعذر الاتصال بالخادم.";
  }
}

export async function authApi<T>(path: string, init?: RequestInit): Promise<T> {
  const API_URL = import.meta.env.VITE_API_URL || "";

const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setAccount(await authApi<AppAccount>("/auth/me"));
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const login = async (phone: string, pin: string) => {
    const result = await authApi<{ account: AppAccount }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, pin }),
    });
    queryClient.clear();
    setAccount(result.account);
  };

  const logout = async () => {
    try {
      await authApi<void>("/auth/logout", { method: "POST" });
    } finally {
      queryClient.clear();
      setAccount(null);
    }
  };

  const value = useMemo(() => ({ account, loading, login, logout, refresh }), [account, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAppAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAppAuth must be used inside AuthProvider");
  return context;
}
