'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { api, ENDPOINTS } from '@/lib/api';

const TOKEN_KEY = 'sergestiona_token';
const USER_KEY = 'sergestiona_user';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  changePassword(current: string, newPwd: string, confirm: string): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken) {
      setToken(storedToken);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // ignore
        }
      }
      // Verify token with server
      api
        .get<User>(ENDPOINTS.AUTH_ME)
        .then((me) => {
          setUser(me);
          localStorage.setItem(USER_KEY, JSON.stringify(me));
        })
        .catch(() => {
          // Token invalid — clear storage
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.post<{ access_token: string; user: User }>(
        ENDPOINTS.LOGIN,
        { email, password }
      );
      const { access_token, user: userData } = response;
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      router.push('/');
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await api.post(ENDPOINTS.AUTH_LOGOUT, {});
    } catch {
      // ignore logout errors
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  const changePassword = useCallback(
    async (current: string, newPwd: string, confirm: string) => {
      await api.post(ENDPOINTS.CHANGE_PASSWORD, {
        current_password: current,
        new_password: newPwd,
        new_password_confirmation: confirm,
      });
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside AuthProvider');
  }
  return ctx;
}
