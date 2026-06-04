'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { api, ENDPOINTS } from '@/lib/api';

const TOKEN_KEY = 'sergestiona_token';
const USER_KEY = 'sergestiona_user';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
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
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  return {
    user,
    token,
    isAuthenticated: !!token,
    login,
    logout,
  };
}
