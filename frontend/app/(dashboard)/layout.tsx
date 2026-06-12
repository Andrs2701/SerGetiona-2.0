'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RightSidebar from '@/components/RightSidebar';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { UserPreferences } from '@/lib/types';
import { Menu } from 'lucide-react';

const RIGHT_SIDEBAR_KEY = 'sergestiona_right_sidebar';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthContext();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estado local inmediato desde localStorage; el backend es la fuente de verdad
  const [rightOpen, setRightOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(RIGHT_SIDEBAR_KEY);
    return stored === null ? true : stored === '1';
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Sincroniza la preferencia persistida en el backend
  useEffect(() => {
    if (!isAuthenticated) return;
    api.get<{ preferences: UserPreferences }>('/preferences')
      .then((res) => {
        const open = res.preferences?.right_sidebar_open;
        if (typeof open === 'boolean') {
          setRightOpen(open);
          localStorage.setItem(RIGHT_SIDEBAR_KEY, open ? '1' : '0');
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const toggleRightSidebar = useCallback(() => {
    setRightOpen((prev) => {
      const next = !prev;
      localStorage.setItem(RIGHT_SIDEBAR_KEY, next ? '1' : '0');
      api.put('/preferences', { right_sidebar_open: next }).catch(() => {});
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header bar with hamburger */}
        <div className="md:hidden h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-indigo-700 tracking-tight">Sergestiona</span>
          <span className="text-xs text-gray-400">2.0</span>
        </div>
        <Header rightSidebarOpen={rightOpen} onToggleRightSidebar={toggleRightSidebar} />
        <div className="flex-1 flex overflow-hidden min-h-0">
          <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
            {children}
          </main>
          <RightSidebar open={rightOpen} onClose={toggleRightSidebar} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedLayout>{children}</ProtectedLayout>
    </AuthProvider>
  );
}
