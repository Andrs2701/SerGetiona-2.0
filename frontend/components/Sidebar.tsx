"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  FileText,
  Users,
  BarChart3,
  Settings,
  ChevronRight,
  CalendarDays,
  UserCircle,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { USER_ROLE_LABELS } from "@/lib/types";

const ADMIN_ROLES = ['admin', 'coordinator'] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthContext();

  const isAdmin = user && ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number]);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, always: true },
    { href: "/proyectos", label: "Proyectos", icon: FolderKanban, always: true },
    { href: "/programas", label: "Programas Académicos", icon: BookOpen, always: true },
    { href: "/entregables", label: "Entregables", icon: FileText, always: true },
    { href: "/calendario", label: "Calendario", icon: CalendarDays, always: true },
    { href: "/mi-espacio", label: "Mi Espacio", icon: UserCircle, always: false, operativeOnly: true },
    { href: "/usuarios", label: "Usuarios", icon: Users, always: true },
    { href: "/reportes", label: "Reportes", icon: BarChart3, always: true },
    { href: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
  ].filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (item.operativeOnly) return !isAdmin;
    return true;
  });

  const initials = user
    ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'US';

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="h-14 flex items-center px-6 border-b border-gray-200">
        <span className="font-bold text-lg text-indigo-700 tracking-tight">Sergestiona</span>
        <span className="ml-1 text-xs font-medium text-gray-400 mt-0.5">2.0</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-indigo-400" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name ?? 'Usuario'}</p>
            <p className="text-xs text-gray-500 truncate">
              {user ? USER_ROLE_LABELS[user.role] : ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
