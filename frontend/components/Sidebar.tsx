"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  CalendarDays,
  UserCircle,
  ClipboardList,
  MessagesSquare,
  X,
  FolderKanban,
  HelpCircle,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { USER_ROLE_LABELS } from "@/lib/types";
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { api, ENDPOINTS } from "@/lib/api";
import { can } from "@/lib/permissions";

type UserRole = 'admin' | 'coordinator' | 'expert' | 'pedagogy' | 'design' | 'audiovisual' | 'engineering' | 'qa';

const OPERATIVE_ROLES: UserRole[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: UserRole[];
  badgeKey?: 'overdue' | 'collab';
  /** Además de `roles`, un rol sin acceso fijo puede entrar si tiene CUALQUIERA de estos permisos. */
  permissions?: Array<{ module: string; action: string }>;
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
    href: '/proyectos',
    label: 'Escuelas / Proyectos',
    icon: FolderKanban,
    roles: ['admin', 'coordinator'],
  },
  {
    href: '/entregables',
    label: 'Entregables',
    icon: FileText,
    roles: ['admin', 'coordinator'],
    permissions: [
      { module: 'entregables', action: 'view' },
      { module: 'entregables', action: 'manage' },
    ],
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
    badgeKey: 'collab',
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
    roles: ['admin', 'coordinator'],
  },
  {
    href: '/configuracion',
    label: 'Configuración',
    icon: Settings,
    roles: ['admin'],
  },
  {
    href: '/ayuda',
    label: 'Ayuda',
    icon: HelpCircle,
    roles: ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'],
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
  const [collabUnread, setCollabUnread] = useState<number>(0);
  const [collabMentions, setCollabMentions] = useState(false);

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

  useEffect(() => {
    if (!user) return;
    function fetchCollab() {
      api.get<unknown>('/channels')
        .then((res) => {
          const raw = res as Record<string, unknown>;
          const chs = (Array.isArray(raw) ? raw : (raw.channels as unknown[]) ?? []) as Array<Record<string, unknown>>;
          let total = 0;
          let mentions = false;
          for (const ch of chs) {
            total += (typeof ch.unread_count === 'number' ? ch.unread_count : 0);
            if (typeof ch.mention_count === 'number' && ch.mention_count > 0) mentions = true;
          }
          setCollabUnread(total);
          setCollabMentions(mentions);
        })
        .catch(() => {});
    }
    fetchCollab();
    const iv = setInterval(fetchCollab, 30_000);
    return () => clearInterval(iv);
  }, [user]);

  const navItems = ALL_NAV_ITEMS.filter((item) =>
    item.roles.includes(role) || (item.permissions ?? []).some((p) => can(user, p.module, p.action))
  );

  const sidebarInner = (
    <aside className="w-64 h-full bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col transition-colors">
      <div className="h-14 flex items-center justify-between px-6 border-b border-[var(--sidebar-border)] flex-shrink-0">
        <Link href="/" className="flex items-baseline gap-1 cursor-pointer hover:opacity-80 transition-opacity">
          <span className="font-bold text-lg tracking-tight" style={{ color: '#194276' }}>Sergestiona</span>
          <span className="text-xs font-medium text-gray-400">2.0</span>
        </Link>
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

          let badgeCount = 0;
          let badgeActiveCls = '';
          let badgeInactiveCls = '';

          if (badgeKey === 'overdue' && overdueCount > 0 && isOperative) {
            badgeCount = overdueCount;
            badgeActiveCls = 'bg-red-400 text-white';
            badgeInactiveCls = 'bg-red-100 text-red-600';
          } else if (badgeKey === 'collab' && collabUnread > 0) {
            badgeCount = collabUnread;
            if (collabMentions) {
              badgeActiveCls = 'bg-amber-400 text-white';
              badgeInactiveCls = 'bg-amber-100 text-amber-700';
            } else {
              badgeActiveCls = 'bg-indigo-400 text-white';
              badgeInactiveCls = 'bg-indigo-100 text-indigo-600';
            }
          }

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
              {badgeCount > 0 && (
                <span
                  className={clsx(
                    "min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center leading-none",
                    active ? badgeActiveCls : badgeInactiveCls
                  )}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
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
          <Avatar
            name={user?.name ?? 'Usuario'}
            photoUrl={user?.photo_url}
            className="w-8 h-8 text-white text-xs"
            style={{ background: '#194276' }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate transition-colors"
              onMouseEnter={e => (e.currentTarget.style.color = '#5b8fd6')}
              onMouseLeave={e => (e.currentTarget.style.color = '')}
            >
              {user?.name ?? 'Usuario'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
              {user ? USER_ROLE_LABELS[user.role] : ''}
              {user?.covering_roles && user.covering_roles.length > 0 && (
                <span className="text-indigo-500 dark:text-indigo-400"> · Cubriendo {user.covering_roles.map(r => USER_ROLE_LABELS[r as keyof typeof USER_ROLE_LABELS] ?? r).join(', ')}</span>
              )}
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
