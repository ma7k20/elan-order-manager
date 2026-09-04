import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

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

const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const AUTH_TOKEN_KEY = "elan_session_token";
setBaseUrl(apiBaseUrl || null);

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

setAuthTokenGetter(getStoredToken);

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: string };
    return data.error || "تعذر إكمال الطلب.";
  } catch {
    return "تعذر الاتصال بالخادم.";
  }
}

export async function authApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    const result = await authApi<{ token: string; account: AppAccount }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, pin }),
    });
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    } catch {
      // Cookie auth remains available as a fallback.
    }
    queryClient.clear();
    setAccount(result.account);
  };

  const logout = async () => {
    try {
      await authApi<void>("/auth/logout", { method: "POST" });
    } finally {
      try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      } catch {
        // Ignore storage cleanup failures.
      }
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
