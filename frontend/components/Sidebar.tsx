"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  Settings,
  CalendarDays,
  UserCircle,
  ClipboardList,
  MessagesSquare,
  X,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { USER_ROLE_LABELS } from "@/lib/types";
import { useEffect, useState } from "react";
import { api, ENDPOINTS } from "@/lib/api";

type UserRole = 'admin' | 'coordinator' | 'expert' | 'pedagogy' | 'design' | 'audiovisual' | 'engineering' | 'qa';

const OPERATIVE_ROLES: UserRole[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: UserRole[];
  badgeKey?: 'overdue';
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'],
    badgeKey: 'overdue',
  },
  {
    href: '/mi-espacio',
    label: 'Mi Espacio',
    icon: UserCircle,
    roles: ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'],
    badgeKey: 'overdue',
  },
  {
    href: '/programas',
    label: 'Programas Académicos',
    icon: BookOpen,
    roles: ['admin', 'coordinator'],
  },
  {
    href: '/entregables',
    label: 'Entregables',
    icon: FileText,
    roles: ['admin', 'coordinator'],
  },
  {
    href: '/decisiones',
    label: 'Decisiones',
    icon: ClipboardList,
    roles: ['admin', 'coordinator'],
  },
  {
    href: '/colaboracion',
    label: 'Colaboración',
    icon: MessagesSquare,
    roles: ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'],
  },
  {
    href: '/calendario',
    label: 'Calendario',
    icon: CalendarDays,
    roles: ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'],
  },
  {
    href: '/usuarios',
    label: 'Usuarios',
    icon: Users,
    roles: ['admin'],
  },
  {
    href: '/configuracion',
    label: 'Configuración',
    icon: Settings,
    roles: ['admin'],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Visibilidad en escritorio; el usuario la controla desde el Header */
  desktopOpen?: boolean;
}

export default function Sidebar({ mobileOpen = false, onMobileClose, desktopOpen = true }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const [overdueCount, setOverdueCount] = useState<number>(0);

  const role = (user?.role ?? 'admin') as UserRole;
  const isOperative = OPERATIVE_ROLES.includes(role);

  useEffect(() => {
    if (!isOperative) return;
    api
      .get<{ stats: { overdue: number } }>(ENDPOINTS.MY_WORKSPACE)
      .then((res) => {
        const data = res as unknown as { stats: { overdue: number } };
        if (data?.stats?.overdue !== undefined) {
          setOverdueCount(data.stats.overdue);
        }
      })
      .catch(() => {});
  }, [isOperative]);

  const navItems = ALL_NAV_ITEMS.filter((item) =>
    item.roles.includes(role)
  );

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || 'US'
    : 'US';

  const sidebarInner = (
    <aside className="w-64 h-full bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col transition-colors">
      <div className="h-14 flex items-center justify-between px-6 border-b border-[var(--sidebar-border)] flex-shrink-0">
        <div className="flex items-baseline gap-1">
          <span className="font-bold text-lg tracking-tight" style={{ color: '#194276' }}>Sergestiona</span>
          <span className="text-xs font-medium text-gray-400">2.0</span>
        </div>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badgeKey }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          const showBadge = badgeKey === 'overdue' && overdueCount > 0 && isOperative;
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
              )}
              style={active ? { background: '#194276' } : undefined}
            >
              <Icon size={18} />
              <span className="flex-1 truncate">{label}</span>
              {showBadge && (
                <span
                  className={clsx(
                    "min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center leading-none",
                    active ? "bg-red-400 text-white" : "bg-red-100 text-red-600"
                  )}
                >
                  {overdueCount > 99 ? "99+" : overdueCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--sidebar-border)] flex-shrink-0">
        <Link
          href="/perfil"
          onClick={onMobileClose}
          className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#194276' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate transition-colors"
              onMouseEnter={e => (e.currentTarget.style.color = '#5b8fd6')}
              onMouseLeave={e => (e.currentTarget.style.color = '')}
            >
              {user?.name ?? 'Usuario'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
              {user ? USER_ROLE_LABELS[user.role] : ''}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar (ocultable para todos los roles) */}
      <div className={clsx('min-h-screen flex-shrink-0', desktopOpen ? 'hidden md:flex' : 'hidden')}>
        {sidebarInner}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
          />
          <div className="relative z-10 flex-shrink-0 h-full shadow-xl">
            {sidebarInner}
          </div>
        </div>
      )}
    </>
  );
}
