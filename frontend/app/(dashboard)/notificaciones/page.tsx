'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, CheckCheck, Trash2, Filter, ClipboardList, RefreshCw,
  MessagesSquare, FileText, CalendarDays, AlertTriangle, UserPlus,
  ArrowRight, CornerDownRight, Pencil, Hash, ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { Notification } from '@/lib/types';
import { ROLE_STATUS_LABELS } from '@/lib/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoy';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

interface NotifTypeConfig {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
}

const NOTIF_TYPES: Record<string, NotifTypeConfig> = {
  task_assigned:        { icon: <ClipboardList size={16} />, label: 'Tarea asignada', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  status_changed:       { icon: <RefreshCw size={16} />,     label: 'Cambio de estado', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  date_changed:         { icon: <CalendarDays size={16} />,  label: 'Fecha modificada', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  adjustments_requested:{ icon: <CornerDownRight size={16} />,label: 'Ajustes solicitados', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  activity_modified:    { icon: <Pencil size={16} />,        label: 'Actividad modificada', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-900/30' },
  next_in_chain:        { icon: <ArrowRight size={16} />,    label: 'Siguiente en cadena', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
  deadline_approaching: { icon: <AlertTriangle size={16} />, label: 'Próximo a vencer', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  overdue:              { icon: <AlertTriangle size={16} />, label: 'Vencida', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  overdue_reminder:     { icon: <AlertTriangle size={16} />, label: 'Recordatorio vencida', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  comment_added:        { icon: <MessagesSquare size={16} />,label: 'Comentario', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
  mention:              { icon: <Hash size={16} />,          label: 'Mención', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
  channel_added:        { icon: <UserPlus size={16} />,      label: 'Agregado a canal', color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-100 dark:bg-teal-900/30' },
  deliverable_approved: { icon: <FileText size={16} />,      label: 'Entregable aprobado', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  deliverable_rejected: { icon: <FileText size={16} />,      label: 'Entregable rechazado', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  deliverable_observation:{ icon: <FileText size={16} />,    label: 'Observación entregable', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  executive_summary:    { icon: <FileText size={16} />,      label: 'Resumen ejecutivo', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
};

const DEFAULT_TYPE: NotifTypeConfig = {
  icon: <Bell size={16} />, label: 'Notificación', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800',
};

function getNotifConfig(type: string): NotifTypeConfig {
  return NOTIF_TYPES[type] ?? DEFAULT_TYPE;
}

function formatCommitmentDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return 'Vence: ' + d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function NotifMetaRow({ data }: { data: Record<string, unknown> }) {
  const parts: string[] = [];
  if (typeof data.program === 'string' && data.program) parts.push(data.program);
  if (typeof data.subject === 'string' && data.subject) parts.push(data.subject);
  if (typeof data.commitment_date === 'string' && data.commitment_date) parts.push(formatCommitmentDate(data.commitment_date));
  if (typeof data.status === 'string' && data.status) {
    const label = ROLE_STATUS_LABELS[data.status] ?? data.status;
    parts.push(label);
  }
  if (!parts.length) return null;
  return (
    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 leading-snug">
      {parts.join(' · ')}
    </p>
  );
}

function getNotifRoute(n: Notification): string | null {
  const d = n.data ?? {};
  const actId = d.activity_id ?? d.role_activity_id;
  const channelId = d.channel_id;
  const deliverableId = d.deliverable_id;

  if (n.type === 'mention' && channelId) return `/colaboracion?channel=${channelId}`;
  if (n.type === 'channel_added' && channelId) return `/colaboracion?channel=${channelId}`;
  if (n.type === 'comment_added' && deliverableId) return `/entregables?filter=status_in_review`;

  if (n.type === 'deliverable_approved' || n.type === 'deliverable_rejected' || n.type === 'deliverable_observation') {
    return '/entregables';
  }

  if (actId) return `/mi-espacio?highlight=${actId}&open=${actId}`;

  if (['task_assigned', 'status_changed', 'date_changed', 'adjustments_requested', 'activity_modified',
       'next_in_chain', 'deadline_approaching', 'overdue', 'overdue_reminder'].includes(n.type)) {
    return '/mi-espacio';
  }

  return null;
}

type FilterType = 'all' | 'unread' | 'tasks' | 'chat' | 'deliverables' | 'deadlines';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'No leídas' },
  { key: 'tasks', label: 'Tareas' },
  { key: 'chat', label: 'Chat' },
  { key: 'deliverables', label: 'Entregables' },
  { key: 'deadlines', label: 'Vencimientos' },
];

function matchesFilter(n: Notification, f: FilterType): boolean {
  if (f === 'all') return true;
  if (f === 'unread') return !n.read_at;
  if (f === 'tasks') return ['task_assigned', 'status_changed', 'date_changed', 'adjustments_requested', 'activity_modified', 'next_in_chain'].includes(n.type);
  if (f === 'chat') return ['mention', 'channel_added', 'comment_added'].includes(n.type);
  if (f === 'deliverables') return n.type.startsWith('deliverable_');
  if (f === 'deadlines') return ['deadline_approaching', 'overdue', 'overdue_reminder'].includes(n.type);
  return true;
}

export default function NotificacionesPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Notification[]>(ENDPOINTS.NOTIFICATIONS);
      const arr = Array.isArray(data) ? data : [];
      setNotifications(arr);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function markRead(id: number) {
    try { await api.post(ENDPOINTS.NOTIFICATION_READ(id), {}); } catch { /* */ }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  async function markAllRead() {
    try { await api.post(ENDPOINTS.NOTIFICATION_READ_ALL, {}); } catch { /* */ }
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  function handleClick(n: Notification) {
    if (!n.read_at) markRead(n.id);
    const route = getNotifRoute(n);
    if (route) router.push(route);
  }

  const filtered = notifications.filter(n => matchesFilter(n, filter));
  const unreadCount = notifications.filter(n => !n.read_at).length;

  const grouped: { date: string; items: Notification[] }[] = [];
  for (const n of filtered) {
    const dateKey = new Date(n.created_at).toDateString();
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateKey) {
      last.items.push(n);
    } else {
      grouped.push({ date: dateKey, items: [n] });
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Bell size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Notificaciones</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            >
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Marcar todas como leídas</span>
              <span className="sm:hidden">Leer todas</span>
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors',
              showFilters
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <Filter size={14} />
            Filtrar
            <ChevronDown size={12} className={clsx('transition-transform', showFilters && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                filter === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Bell size={28} className="text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {filter === 'all' ? 'No tienes notificaciones' : 'No hay notificaciones con este filtro'}
          </p>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="mt-2 text-sm text-indigo-600 hover:text-indigo-700">
              Ver todas
            </button>
          )}
        </div>
      )}

      {/* Grouped list */}
      {!loading && grouped.map(group => (
        <div key={group.date} className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {formatDate(group.items[0].created_at)}
            </span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          </div>

          <div className="space-y-1">
            {group.items.map(n => {
              const cfg = getNotifConfig(n.type);
              const route = getNotifRoute(n);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={clsx(
                    'w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-colors group',
                    !n.read_at
                      ? 'bg-blue-50/70 dark:bg-blue-900/15 hover:bg-blue-50 dark:hover:bg-blue-900/25'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  )}
                >
                  {/* Icon */}
                  <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-none mt-0.5', cfg.bgColor, cfg.color)}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={clsx(
                        'text-sm leading-snug',
                        !n.read_at ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'
                      )}>
                        {n.title}
                      </p>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex-none">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                    {n.data && Object.keys(n.data).length > 0 && (
                      <NotifMetaRow data={n.data as Record<string, unknown>} />
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-full', cfg.bgColor, cfg.color)}>
                        {cfg.label}
                      </span>
                      {!n.read_at && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-none" />
                      )}
                      {route && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight size={10} /> Ir al detalle
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
