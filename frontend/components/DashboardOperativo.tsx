'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  XCircle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  CalendarDays,
  Timer,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { api, ENDPOINTS } from '@/lib/api';
import type { Workspace, WorkspaceActivity } from '@/lib/types';
import { ROLE_STATUS_LABELS, USER_ROLE_LABELS, DELIVERABLE_TYPE_LABELS } from '@/lib/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function endOfWeek(d: Date) {
  const mon = startOfWeek(d);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

function computeWeeklyProgress(activities: WorkspaceActivity[]) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const thisWeek = activities.filter((a) => {
    if (!a.commitment_date) return false;
    const d = new Date(a.commitment_date + 'T00:00:00');
    return d >= weekStart && d <= weekEnd;
  });

  if (thisWeek.length === 0) return null;

  const delivered = thisWeek.filter((a) =>
    ['approved', 'delivered', 'in_review'].includes(a.status)
  ).length;

  return {
    delivered,
    total: thisWeek.length,
    pct: Math.round((delivered / thisWeek.length) * 100),
  };
}

function computeAutoStatus(act: WorkspaceActivity): { label: string; cls: string } {
  if (act.status === 'approved') {
    if (act.actual_delivery_date && act.commitment_date) {
      const onTime = act.actual_delivery_date <= act.commitment_date;
      return onTime
        ? { label: 'Entregada a tiempo', cls: 'text-emerald-700 bg-emerald-50' }
        : { label: 'Entregada fuera de tiempo', cls: 'text-amber-700 bg-amber-50' };
    }
    return { label: 'Aprobada', cls: 'text-emerald-700 bg-emerald-50' };
  }
  if (act.date_status === 'overdue') return { label: 'Vencida', cls: 'text-red-700 bg-red-50' };
  if (act.status === 'adjustments_requested') return { label: 'Devuelta', cls: 'text-orange-700 bg-orange-50' };
  if (['delivered', 'in_review', 'in_testing', 'validating'].includes(act.status))
    return { label: 'En Revisión', cls: 'text-purple-700 bg-purple-50' };
  if (['in_progress', 'in_development', 'designing', 'production', 'implementing', 'draft'].includes(act.status))
    return { label: 'En Proceso', cls: 'text-blue-700 bg-blue-50' };
  return { label: 'Pendiente', cls: 'text-gray-600 bg-gray-100' };
}

function daysDiff(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date + 'T00:00:00');
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function urgencyOrder(act: WorkspaceActivity): number {
  if (act.date_status === 'overdue') return 0;
  if (act.date_status === 'approaching') return 1;
  return 2;
}

// ─── Priority badge ──────────────────────────────────────────────────────────

function PriorityBadge({ act }: { act: WorkspaceActivity }) {
  if (act.status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
        Verde
      </span>
    );
  }
  if (act.date_status === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700">
        Rojo
      </span>
    );
  }
  if (act.date_status === 'approaching') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700">
        Naranja
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700">
      Verde
    </span>
  );
}

// ─── Quick Action Button ─────────────────────────────────────────────────────

function QuickActionBtn({
  act,
  onNavigate,
}: {
  act: WorkspaceActivity;
  onNavigate: () => void;
}) {
  if (act.status === 'adjustments_requested') {
    return (
      <button
        onClick={onNavigate}
        className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 hover:bg-orange-100 transition-colors font-medium flex-shrink-0"
      >
        <RotateCcw size={11} /> Corregir
      </button>
    );
  }
  if (act.status === 'delivered') {
    return (
      <button
        onClick={onNavigate}
        className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1 hover:bg-purple-100 transition-colors font-medium flex-shrink-0"
      >
        <Eye size={11} /> Ver estado
      </button>
    );
  }
  return (
    <button
      onClick={onNavigate}
      className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 hover:bg-indigo-100 transition-colors font-medium flex-shrink-0"
    >
      <Send size={11} /> Entregar
    </button>
  );
}

// ─── Priority Section ─────────────────────────────────────────────────────────

interface PriorityGroup {
  key: string;
  title: string;
  dot: string;
  emptyMsg: string;
  items: WorkspaceActivity[];
}

function PriorityGroupPanel({
  group,
  onNavigate,
}: {
  group: PriorityGroup;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(group.items.length > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${group.dot}`} />
          <span className="text-sm font-semibold text-gray-800">{group.title}</span>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
            {group.items.length}
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {/* Items */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {group.items.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">{group.emptyMsg}</p>
          ) : (
            group.items.map((act) => {
              const diff = act.commitment_date ? daysDiff(act.commitment_date) : null;
              return (
                <div
                  key={act.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{act.deliverable?.name ?? '—'}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      {act.program?.name ?? '—'} · {act.subject?.name ?? '—'}
                    </p>
                  </div>
                  {diff !== null && (
                    <span
                      className={`text-[10px] font-semibold flex-shrink-0 ${
                        diff < 0
                          ? 'text-red-600'
                          : diff <= 3
                          ? 'text-orange-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {diff < 0
                        ? `−${Math.abs(diff)}d`
                        : diff === 0
                        ? 'Hoy'
                        : `+${diff}d`}
                    </span>
                  )}
                  <QuickActionBtn act={act} onNavigate={onNavigate} />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────

function useCountdown(targetDate: string | undefined) {
  const [remaining, setRemaining] = useState('');
  const [expired, setExpired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!targetDate) return;

    function compute() {
      const target = new Date(targetDate! + 'T23:59:59').getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setExpired(true);
        setRemaining('Vencida');
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      setExpired(false);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${days > 0 ? `${days}d ` : ''}${hours}h ${mins}m`);
    }

    compute();
    intervalRef.current = setInterval(compute, 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [targetDate]);

  return { remaining, expired };
}

// ─── Countdown Banner ────────────────────────────────────────────────────────

function CountdownBanner({ activities }: { activities: WorkspaceActivity[] }) {
  const next = [...activities]
    .filter((a) => a.status !== 'approved' && a.commitment_date)
    .filter((a) => {
      const d = daysDiff(a.commitment_date!);
      return d >= 0 && d <= 30;
    })
    .sort((a, b) => (a.commitment_date ?? '').localeCompare(b.commitment_date ?? ''))[0];

  const { remaining, expired } = useCountdown(next?.commitment_date);

  if (!next) return null;

  const d = daysDiff(next.commitment_date!);
  const urgent = d <= 2;

  return (
    <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${urgent ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-200'}`}>
      <div className={`rounded-lg p-2.5 flex-shrink-0 ${urgent ? 'bg-amber-100' : 'bg-indigo-100'}`}>
        <Timer className={`w-5 h-5 ${urgent ? 'text-amber-600' : 'text-indigo-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold uppercase tracking-wide ${urgent ? 'text-amber-600' : 'text-indigo-500'}`}>
          Próxima entrega
        </p>
        <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{next.deliverable?.name ?? '—'}</p>
        <p className="text-xs text-gray-500 truncate">{next.program?.name ?? '—'} · {next.subject?.name ?? '—'}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-xl font-bold tabular-nums ${expired ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-indigo-600'}`}>
          {remaining}
        </p>
        <p className="text-xs text-gray-400">{formatDate(next.commitment_date!)}</p>
      </div>
    </div>
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ value }: { value: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-sm font-bold text-gray-800">{value}%</span>
    </div>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ act, onClick }: { act: WorkspaceActivity; onClick: () => void }) {
  const autoStatus = computeAutoStatus(act);
  const dueInfo = act.commitment_date ? (() => {
    const d = daysDiff(act.commitment_date!);
    if (d < 0) return { text: `Vencida hace ${Math.abs(d)} día(s)`, cls: 'text-red-600 font-semibold' };
    if (d === 0) return { text: 'Vence hoy', cls: 'text-amber-600 font-semibold' };
    if (d <= 5) return { text: `Vence en ${d} día(s)`, cls: 'text-amber-500' };
    return { text: formatDate(act.commitment_date!), cls: 'text-gray-500' };
  })() : null;

  const leftBorder =
    act.date_status === 'overdue' ? 'border-l-4 border-l-red-400' :
    act.date_status === 'approaching' ? 'border-l-4 border-l-amber-400' :
    'border-l-4 border-l-blue-100';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-indigo-200 transition-all group ${leftBorder}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight">{act.deliverable?.name ?? '—'}</p>
        {act.date_status === 'overdue' && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
            <XCircle size={10} /> Vencida
          </span>
        )}
        {act.date_status === 'approaching' && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
            <AlertTriangle size={10} /> Por vencer
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400 truncate mb-3">{act.program?.name ?? '—'} · {act.subject?.name ?? '—'}</p>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${autoStatus.cls}`}>
            {autoStatus.label}
          </span>
          {act.deliverable && (
          <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-medium">
            {DELIVERABLE_TYPE_LABELS[act.deliverable.type]}
          </span>
          )}
        </div>
        {dueInfo && (
          <div className="flex items-center gap-1 text-xs">
            <CalendarDays size={11} className="text-gray-400" />
            <span className={dueInfo.cls}>{dueInfo.text}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
        Ver en Mi Espacio <ArrowRight size={12} className="ml-1" />
      </div>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardOperativo() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableExpanded, setTableExpanded] = useState(false);

  useEffect(() => {
    api
      .get<Workspace>(ENDPOINTS.MY_WORKSPACE)
      .then(setWorkspace)
      .catch(() => setWorkspace(null))
      .finally(() => setLoading(false));
  }, []);

  // ← loading guard MUST come before the null guard
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 animate-pulse h-16" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 animate-pulse h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          No fue posible cargar la información operativa.
          <br />
          <span className="text-xs text-red-400 mt-1 block">Intenta recargar la página o contacta al administrador.</span>
        </div>
      </div>
    );
  }

  const data = workspace;
  const activities = data.activities ?? [];

  // KPIs
  const total     = activities.length;
  const pending   = activities.filter((a) => ['not_started', 'pending'].includes(a.status)).length;
  const overdue   = activities.filter((a) => a.date_status === 'overdue' && a.status !== 'approved').length;
  const completed = activities.filter((a) => a.status === 'approved').length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const weekly    = computeWeeklyProgress(activities);

  // Priority activities
  const priorityActivities = [...activities]
    .filter((a) => a.status !== 'approved')
    .sort((a, b) => {
      const diff = urgencyOrder(a) - urgencyOrder(b);
      if (diff !== 0) return diff;
      return (a.commitment_date ?? '').localeCompare(b.commitment_date ?? '');
    })
    .slice(0, 9);

  // Mis Prioridades groups
  const overdueActs = activities
    .filter((a) => a.date_status === 'overdue' && a.status !== 'approved')
    .sort((a, b) => (a.commitment_date ?? '').localeCompare(b.commitment_date ?? ''));

  const approachingActs = activities
    .filter((a) => {
      if (a.status === 'approved' || a.date_status === 'overdue') return false;
      const d = a.commitment_date ? daysDiff(a.commitment_date) : null;
      return d !== null && d >= 0 && d <= 3;
    })
    .sort((a, b) => (a.commitment_date ?? '').localeCompare(b.commitment_date ?? ''));

  const returnedActs = activities
    .filter((a) => a.status === 'adjustments_requested')
    .sort((a, b) => (a.commitment_date ?? '').localeCompare(b.commitment_date ?? ''));

  const pendingApprovalActs = activities
    .filter((a) => a.status === 'delivered')
    .sort((a, b) => (a.commitment_date ?? '').localeCompare(b.commitment_date ?? ''));

  const priorityGroups: PriorityGroup[] = [
    {
      key: 'overdue',
      title: 'Vencidas',
      dot: 'bg-red-500',
      emptyMsg: 'Sin actividades vencidas',
      items: overdueActs,
    },
    {
      key: 'approaching',
      title: 'Por Vencer (próximos 3 días)',
      dot: 'bg-yellow-400',
      emptyMsg: 'Sin actividades por vencer pronto',
      items: approachingActs,
    },
    {
      key: 'returned',
      title: 'Devueltas — Requieren acción',
      dot: 'bg-blue-400',
      emptyMsg: 'Sin actividades devueltas',
      items: returnedActs,
    },
    {
      key: 'pending_approval',
      title: 'Pendientes Aprobación',
      dot: 'bg-gray-300',
      emptyMsg: 'Sin actividades esperando aprobación',
      items: pendingApprovalActs,
    },
  ];

  const userRoleLabel = (USER_ROLE_LABELS as Record<string, string>)[data.role] ?? data.role;
  const TABLE_COMPACT_ROWS = 5;

  return (
    <div className="p-6 space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{data.user.name} · {userRoleLabel}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Pendientes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-gray-100 rounded-lg p-2 flex-shrink-0">
            <Clock className="text-gray-600 w-4 h-4" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{pending}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </div>
        </div>

        {/* Vencidas */}
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className={`rounded-lg p-2 flex-shrink-0 ${overdue > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
            <XCircle className={`w-4 h-4 ${overdue > 0 ? 'text-red-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${overdue > 0 ? 'text-red-700' : 'text-gray-900'}`}>{overdue}</p>
            <p className={`text-xs ${overdue > 0 ? 'text-red-500' : 'text-gray-500'}`}>Vencidas</p>
          </div>
        </div>

        {/* Completadas */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-emerald-50 rounded-lg p-2 flex-shrink-0">
            <CheckCircle2 className="text-emerald-600 w-4 h-4" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{completed}</p>
            <p className="text-xs text-gray-500">Completadas</p>
          </div>
        </div>

        {/* % Avance */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
          <ProgressRing value={progressPct} />
          <div>
            <p className="text-sm font-semibold text-gray-900">Avance</p>
            <p className="text-xs text-gray-500">{completed}/{total}</p>
          </div>
        </div>

        {/* % Semanal */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-blue-50 rounded-lg p-2 flex-shrink-0">
            <TrendingUp className="text-blue-600 w-4 h-4" />
          </div>
          <div>
            {weekly ? (
              <>
                <p className="text-2xl font-bold text-gray-900">{weekly.pct}%</p>
                <p className="text-xs text-gray-500">{weekly.delivered}/{weekly.total} esta semana</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-400">—</p>
                <p className="text-xs text-gray-400">Sin entregas esta sem.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Countdown banner */}
      <CountdownBanner activities={activities} />

      {/* ── MIS PRIORIDADES ── */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900">Mis Prioridades</h2>
          <p className="text-xs text-gray-400 mt-0.5">Actividades que requieren tu atención inmediata</p>
        </div>
        <div className="space-y-2">
          {priorityGroups.map((group) => (
            <PriorityGroupPanel
              key={group.key}
              group={group}
              onNavigate={() => router.push('/mi-espacio')}
            />
          ))}
        </div>
      </div>

      {/* Priority tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Próximas entregas</h2>
            <p className="text-xs text-gray-400 mt-0.5">Actividades ordenadas por urgencia</p>
          </div>
          <button
            onClick={() => router.push('/mi-espacio')}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Ver todas <ArrowRight size={14} />
          </button>
        </div>

        {priorityActivities.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
            Sin actividades pendientes
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {priorityActivities.map((act) => (
              <ActivityCard
                key={act.id}
                act={act}
                onClick={() => router.push('/mi-espacio')}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Tabla de actividades — compacta por defecto ── */}
      {activities.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Resumen de actividades</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ordenadas por urgencia</p>
            </div>
            <button
              onClick={() => setTableExpanded(v => !v)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              {tableExpanded ? 'Ver menos' : `Ver todas (${activities.length})`}
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Entregable</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Programa</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Estado</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Prioridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...activities]
                    .sort((a, b) => urgencyOrder(a) - urgencyOrder(b))
                    .slice(0, tableExpanded ? activities.length : TABLE_COMPACT_ROWS)
                    .map((act) => {
                      const autoStatus = computeAutoStatus(act);
                      return (
                        <tr
                          key={act.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => router.push('/mi-espacio')}
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900 truncate max-w-[200px]">{act.deliverable?.name ?? '—'}</p>
                            <p className="text-gray-400 truncate max-w-[200px] text-[10px]">{act.subject?.name ?? '—'}</p>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 truncate max-w-[160px]">{act.program?.name ?? '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">
                            {act.commitment_date ? (() => {
                              const d = daysDiff(act.commitment_date!);
                              return (
                                <span className={d < 0 ? 'text-red-600 font-semibold' : d <= 3 ? 'text-orange-500 font-medium' : ''}>
                                  {formatDate(act.commitment_date!)}
                                </span>
                              );
                            })() : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${autoStatus.cls}`}>
                              {autoStatus.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5"><PriorityBadge act={act} /></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {!tableExpanded && activities.length > TABLE_COMPACT_ROWS && (
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 text-center">
                <button
                  onClick={() => setTableExpanded(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Mostrar {activities.length - TABLE_COMPACT_ROWS} actividades más
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
