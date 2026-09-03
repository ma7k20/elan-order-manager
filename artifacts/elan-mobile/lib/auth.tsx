import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';

const TOKEN_KEY = 'elan_internal_session';
const domain = process.env.EXPO_PUBLIC_DOMAIN;
const apiBaseUrl = domain ? `https://${domain}/api` : '/api';

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

async function errorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: string };
    return data.error || 'تعذر إكمال الطلب.';
  } catch {
    return 'تعذر الاتصال بالخادم.';
  }
}

export async function mobileAuthApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) {
      setAccount(null);
      setLoading(false);
      return;
    }
    try {
      setAccount(await mobileAuthApi<AppAccount>('/auth/me'));
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setAuthTokenGetter(() => SecureStore.getItemAsync(TOKEN_KEY));
    void refresh();
    return () => setAuthTokenGetter(null);
  }, []);

  const login = async (phone: string, pin: string) => {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin }),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    const result = await response.json() as { token: string; account: AppAccount };
    await SecureStore.setItemAsync(TOKEN_KEY, result.token);
    setAccount(result.account);
  };

  const logout = async () => {
    try {
      await mobileAuthApi<void>('/auth/logout', { method: 'POST' });
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setAccount(null);
    }
  };

  const value = useMemo(() => ({ account, loading, login, logout, refresh }), [account, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useMobileAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useMobileAuth must be used inside MobileAuthProvider');
  return context;
}