'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, ChevronDown, User, KeyRound, LogOut, CheckCheck, PanelRight, PanelLeft, Sun, Moon, Menu } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { clsx } from 'clsx';
import { useAuthContext } from '@/contexts/AuthContext';
import { api, ENDPOINTS } from '@/lib/api';
import type { Notification } from '@/lib/types';
import { USER_ROLE_LABELS } from '@/lib/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

function notifIcon(type: string) {
  if (type === 'task_assigned')       return '📋';
  if (type === 'status_changed')      return '🔄';
  if (type === 'date_changed')        return '📅';
  if (type === 'adjustments_requested') return '↩️';
  if (type === 'activity_modified')   return '✏️';
  if (type === 'next_in_chain')       return '▶️';
  if (type === 'deadline_approaching') return '⏰';
  if (type === 'overdue')             return '🔴';
  if (type === 'comment_added')       return '💬';
  return '🔔';
}

interface HeaderProps {
  title?: string;
  rightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
  leftSidebarOpen?: boolean;
  onToggleLeftSidebar?: () => void;
  onMobileMenuOpen?: () => void;
}

export default function Header({
  title,
  rightSidebarOpen,
  onToggleRightSidebar,
  leftSidebarOpen,
  onToggleLeftSidebar,
  onMobileMenuOpen,
}: HeaderProps) {
  const { user, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  function fetchNotifications() {
    api
      .get<Notification[]>(ENDPOINTS.NOTIFICATIONS)
      .then((data) => {
        setNotifications(data.slice(0, 10));
        setUnread(data.filter((n) => !n.read_at).length);
      })
      .catch(() => {});
  }

  // Initial load + poll every 30 s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function markAllRead() {
    try {
      await api.post(ENDPOINTS.NOTIFICATION_READ_ALL, {});
    } catch {
      // ignore
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    setUnread(0);
  }

  async function markRead(id: number) {
    try {
      await api.post(ENDPOINTS.NOTIFICATION_READ(id), {});
    } catch {
      // ignore
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    setUnread((prev) => Math.max(0, prev - 1));
  }

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || 'US'
    : 'US';

  return (
    <header className="h-14 bg-[var(--header-bg)] border-b border-[var(--header-border)] flex items-center justify-between px-3 sm:px-6 flex-shrink-0 transition-colors gap-2">
      {/* Left: hamburger (mobile) + sidebar toggle (desktop) */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger para móvil */}
        {onMobileMenuOpen && (
          <button
            onClick={onMobileMenuOpen}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
        )}
        {/* Toggle panel izquierdo en escritorio */}
        {onToggleLeftSidebar && (
          <button
            onClick={onToggleLeftSidebar}
            className={clsx(
              'hidden md:block p-2 rounded-lg transition-colors',
              leftSidebarOpen
                ? 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50'
            )}
            title={leftSidebarOpen ? 'Ocultar menú lateral' : 'Mostrar menú lateral'}
          >
            <PanelLeft size={18} />
          </button>
        )}
        {title && <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 truncate">{title}</h2>}
      </div>

      {/* Right: panel toggle + bell + avatar */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        {/* Right sidebar toggle (solo escritorio amplio) */}
        {onToggleRightSidebar && (
          <button
            onClick={onToggleRightSidebar}
            className={clsx(
              'hidden xl:block p-2 rounded-lg transition-colors',
              rightSidebarOpen
                ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
            title={rightSidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
          >
            <PanelRight size={18} />
          </button>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { const opening = !notifOpen; setNotifOpen(opening); setUserOpen(false); if (opening) fetchNotifications(); }}
            className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 w-[calc(100vw-1.5rem)] sm:w-96 max-w-[24rem] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Notificaciones</h3>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    <CheckCheck size={13} />
                    Marcar todas como leídas
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                {notifications.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-8">Sin notificaciones</p>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.read_at && markRead(n.id)}
                    className={clsx(
                      'px-4 py-3 flex gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                      !n.read_at && 'bg-blue-50 dark:bg-blue-900/20'
                    )}
                  >
                    <span className="text-lg flex-shrink-0">{notifIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm', !n.read_at ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2">
                <Link
                  href="/notificaciones"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  onClick={() => setNotifOpen(false)}
                >
                  Ver todas
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => { setUserOpen(!userOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 px-1.5 sm:px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="hidden md:block text-left max-w-[140px]">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-tight truncate">{user?.name ?? 'Usuario'}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight truncate">
                {user ? USER_ROLE_LABELS[user.role] : ''}
              </p>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-12 w-52 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-50 py-1">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
              <Link
                href="/perfil"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setUserOpen(false)}
              >
                <User size={15} />
                Mi perfil
              </Link>
              <Link
                href="/perfil"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setUserOpen(false)}
              >
                <KeyRound size={15} />
                Cambiar contraseña
              </Link>
              {/* Dark mode toggle inline */}
              <button
                onClick={() => { toggleTheme(); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full text-left"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                <button
                  onClick={() => { setUserOpen(false); logout(); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full text-left"
                >
                  <LogOut size={15} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
