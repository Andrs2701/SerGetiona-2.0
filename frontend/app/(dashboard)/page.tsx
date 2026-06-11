'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban,
  BookOpen,
  Activity,
  XCircle,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Users,
  Clock,
  Package,
  MessageSquare,
  X,
  CalendarDays,
  Gauge,
} from 'lucide-react';
import DashboardOperativo from '@/components/DashboardOperativo';
import { StatsSkeleton } from '@/components/LoadingSkeleton';
import HealthBadge from '@/components/HealthBadge';
import CapacityBar from '@/components/CapacityBar';
import { api, ENDPOINTS } from '@/lib/api';
import type {
  DashboardStats,
  ProgramBreakdown,
  ActivityByRoleDetail,
  HealthReport,
  CapacitySummary,
  CapacityUser,
} from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const ADMIN_ROLES = ['admin', 'coordinator'] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'bg-indigo-500' }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function progressColor(pct: number) {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

function GlobalRing({ value }: { value: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width="144" height="144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="72" cy="72" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold text-gray-900">{value}%</p>
        <p className="text-xs text-gray-500 mt-0.5">Avance</p>
      </div>
    </div>
  );
}

// ─── Status label/color map ───────────────────────────────────────────────────

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  finished:          { label: 'Finalizado',        color: 'bg-emerald-500' },
  in_progress:       { label: 'En Ejecución',       color: 'bg-blue-500' },
  in_review:         { label: 'En Revisión',        color: 'bg-purple-500' },
  with_observations: { label: 'Con Observaciones',  color: 'bg-amber-400' },
  pending_start:     { label: 'Pend. Inicio',       color: 'bg-gray-400' },
  unpublished:       { label: 'Sin Publicar',       color: 'bg-gray-300' },
  cancelled:         { label: 'Cancelado',          color: 'bg-red-300' },
  not_applicable:    { label: 'No Aplica',          color: 'bg-slate-300' },
};

// ─── Panel types ─────────────────────────────────────────────────────────────

type PanelFilter =
  | 'active_projects'
  | 'programs'
  | 'total_deliverables'
  | 'overdue'
  | 'approaching'
  | 'with_observations'
  | `status_${string}`
  | `role_${string}`;

interface PanelRow {
  id: number;
  name: string;
  responsible?: string;
  program?: string;
  subject?: string;
  commitment_date?: string;
  days_diff?: number;
  status?: string;
  role?: string;
}

function panelTitle(filter: PanelFilter): string {
  const map: Record<string, string> = {
    active_projects: 'Proyectos Activos',
    programs: 'Programas',
    total_deliverables: 'Total Entregables',
    overdue: 'Actividades Vencidas',
    approaching: 'Por Vencer (próximos días)',
    with_observations: 'Con Observaciones',
  };
  if (map[filter]) return map[filter];
  if (filter.startsWith('status_')) {
    const st = filter.replace('status_', '');
    return STATUS_INFO[st]?.label ?? st;
  }
  if (filter.startsWith('role_')) {
    const rl = filter.replace('role_', '') as keyof typeof ROLE_LABELS;
    return `Rol: ${ROLE_LABELS[rl] ?? rl}`;
  }
  return filter;
}

function formatDateStr(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── SlidingPanel ─────────────────────────────────────────────────────────────

function SlidingPanel({
  filter,
  onClose,
}: {
  filter: PanelFilter | null;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PanelRow[]>([]);
  const [loadingPanel, setLoadingPanel] = useState(false);

  const fetchRows = useCallback(async (f: PanelFilter) => {
    setLoadingPanel(true);
    try {
      let endpoint = '/deliverables';
      const params: Record<string, string> = {};
      if (f === 'overdue') { endpoint = '/reports/compliance'; params['date_status'] = 'overdue'; }
      else if (f === 'approaching') { endpoint = '/reports/compliance'; params['date_status'] = 'approaching'; }
      else if (f === 'with_observations') { endpoint = '/deliverables'; params['status'] = 'with_observations'; }
      else if (f.startsWith('status_')) { endpoint = '/deliverables'; params['status'] = f.replace('status_', ''); }

      const query = Object.keys(params).length
        ? '?' + new URLSearchParams(params).toString()
        : '';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await api.get<any[]>(endpoint + query);
      if (Array.isArray(data) && data.length > 0) {
        // Map API response to PanelRow
        const mapped: PanelRow[] = data.map((item, idx) => ({
          id: item.id ?? idx,
          name: item.name ?? item.deliverable?.name ?? '—',
          responsible: item.responsible ?? item.user?.name ?? item.next_responsible ?? '—',
          program: item.program?.name ?? item.program_name ?? '—',
          subject: item.subject?.name ?? item.subject_name ?? '—',
          commitment_date: item.commitment_date ?? item.due_date,
          days_diff: item.commitment_date
            ? Math.round((new Date(item.commitment_date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)
            : undefined,
          status: item.status ?? item.date_status,
          role: item.role,
        }));
        setRows(mapped);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoadingPanel(false);
    }
  }, []);

  useEffect(() => {
    if (filter) fetchRows(filter);
  }, [filter, fetchRows]);

  const visible = filter !== null;

  return (
    <>
      {/* Overlay */}
      {visible && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl z-50 flex flex-col transition-transform duration-300 ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Detalle filtrado</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">
              {filter ? panelTitle(filter) : ''}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loadingPanel ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-xl h-20 animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2 py-20">
              <CheckCircle2 size={36} className="text-emerald-300" />
              <p>Sin registros para este filtro</p>
            </div>
          ) : (
            rows.map((row) => {
              const isOverdue = (row.days_diff ?? 0) < 0;
              const isApproaching = (row.days_diff ?? 0) >= 0 && (row.days_diff ?? 99) <= 3;
              const borderCls = isOverdue
                ? 'border-l-4 border-l-red-400'
                : isApproaching
                ? 'border-l-4 border-l-amber-400'
                : 'border-l-4 border-l-blue-100';

              return (
                <div
                  key={row.id}
                  className={`bg-white rounded-xl border border-gray-200 p-4 ${borderCls}`}
                >
                  <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{row.name}</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                    {row.responsible && (
                      <span className="flex items-center gap-1">
                        <Users size={10} className="text-gray-300 flex-shrink-0" />
                        <span className="truncate">{row.responsible}</span>
                      </span>
                    )}
                    {row.program && (
                      <span className="flex items-center gap-1 truncate">
                        <BookOpen size={10} className="text-gray-300 flex-shrink-0" />
                        <span className="truncate">{row.program}</span>
                      </span>
                    )}
                    {row.subject && (
                      <span className="flex items-center gap-1 truncate">
                        <Activity size={10} className="text-gray-300 flex-shrink-0" />
                        <span className="truncate">{row.subject}</span>
                      </span>
                    )}
                    {row.commitment_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={10} className="text-gray-300 flex-shrink-0" />
                        <span>{formatDateStr(row.commitment_date)}</span>
                      </span>
                    )}
                  </div>
                  {row.days_diff !== undefined && (
                    <div className="mt-2">
                      {isOverdue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                          <XCircle size={10} /> Vencida hace {Math.abs(row.days_diff)} día(s)
                        </span>
                      ) : isApproaching ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                          <AlertTriangle size={10} /> Vence en {row.days_diff} día(s)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 rounded-full px-2 py-0.5">
                          <Clock size={10} /> {row.days_diff} días restantes
                        </span>
                      )}
                    </div>
                  )}
                  {row.status && (
                    <div className="mt-1.5">
                      <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                        {STATUS_INFO[row.status]?.label ?? row.status}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-400 text-center">{rows.length} registros encontrados</p>
        </div>
      </div>
    </>
  );
}

// ─── Dashboard Admin ──────────────────────────────────────────────────────────

// Map PanelFilter → URL query string for /entregables
function filterToUrl(filter: PanelFilter): string {
  if (filter === 'overdue') return '/entregables?filter=overdue';
  if (filter === 'approaching') return '/entregables?filter=approaching';
  if (filter === 'with_observations') return '/entregables?filter=with_observations';
  if (filter === 'total_deliverables') return '/entregables';
  if (filter === 'active_projects') return '/proyectos';
  if (filter === 'programs') return '/programas';
  if (filter.startsWith('status_')) return `/entregables?filter=${filter}`;
  if (filter.startsWith('role_')) return `/entregables?filter=${filter}`;
  return '/entregables';
}

interface WorkloadUser {
  user_id: number;
  user_name: string;
  role: string;
  total: number;
  pending: number;
  in_review: number;
  overdue: number;
  completed: number;
}

const WORKLOAD_COMPACT = 5;

function DashboardAdmin() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [workload, setWorkload] = useState<WorkloadUser[]>([]);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [capacity, setCapacity] = useState<{ summary: CapacitySummary; users: CapacityUser[] } | null>(null);
  const [workloadExpanded, setWorkloadExpanded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api
      .get<DashboardStats>(ENDPOINTS.DASHBOARD)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
    api.get<WorkloadUser[]>('/reports/workload')
      .then(data => setWorkload(Array.isArray(data) ? data : []))
      .catch(() => {});
    api.get<HealthReport>('/reports/health')
      .then(setHealth)
      .catch(() => {});
    api.get<{ summary: CapacitySummary; users: CapacityUser[] }>('/capacity')
      .then(setCapacity)
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <StatsSkeleton />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          No fue posible cargar los indicadores del dashboard.
        </div>
      </div>
    );
  }

  const d = stats;
  const globalPct = d.global_compliance_percentage ?? d.compliance_percentage ?? 0;
  const programs: ProgramBreakdown[] = d.programs_breakdown ?? [];
  const roleDetail: ActivityByRoleDetail[] = d.activities_by_role_detail ?? [];
  const byStatus = d.deliverables_by_status ?? {};

  const byProgress = [...programs].sort((a, b) => b.compliance_percentage - a.compliance_percentage);
  const byOverdue  = [...programs].sort((a, b) => b.overdue_count - a.overdue_count).filter(p => p.overdue_count > 0);
  const maxActive = Math.max(...roleDetail.map((r) => r.active), 1);
  const statusTotal = Object.values(byStatus).reduce((s, v) => s + v, 0) || 1;

  // KPI cards config
  const kpiCards: Array<{
    label: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    bg: string;
    ring: string;
    highlight?: boolean;
    filter: PanelFilter;
  }> = [
    {
      label: 'Proyectos Activos',
      value: d.active_projects,
      icon: FolderKanban,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      ring: 'hover:ring-indigo-300',
      filter: 'active_projects',
    },
    {
      label: 'Programas',
      value: d.total_programs,
      icon: BookOpen,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      ring: 'hover:ring-emerald-300',
      filter: 'programs',
    },
    {
      label: 'Total Entregables',
      value: d.total_deliverables,
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      ring: 'hover:ring-amber-300',
      filter: 'total_deliverables',
    },
    {
      label: 'Vencidas',
      value: d.overdue_activities,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      ring: 'hover:ring-red-300',
      highlight: (d.overdue_activities ?? 0) > 0,
      filter: 'overdue',
    },
    {
      label: 'Por Vencer',
      value: d.approaching_activities,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      ring: 'hover:ring-orange-300',
      filter: 'approaching',
    },
    {
      label: 'Con Observaciones',
      value: d.with_observations,
      icon: MessageSquare,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      ring: 'hover:ring-purple-300',
      filter: 'with_observations',
    },
  ];

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Heading */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visión global de producción académica</p>
        </div>

        {/* ── Row 1: 6 KPI cards clickeables ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpiCards.map(({ label, value, icon: Icon, color, bg, ring, highlight, filter }) => (
            <button
              key={label}
              onClick={() => router.push(filterToUrl(filter))}
              className={`rounded-xl border p-4 flex flex-col gap-2 text-left transition-all cursor-pointer ring-2 ring-transparent ${ring} hover:shadow-md active:scale-95 ${
                highlight ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className={`${bg} rounded-lg p-2 self-start`}>
                <Icon className={`${color} w-4 h-4`} />
              </div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 leading-tight">{label}</p>
            </button>
          ))}
        </div>

        {/* ── Row 1.5: Salud de proyectos + Capacidad del equipo (evolución 2026) ── */}
        {(health || capacity) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {health && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} className="text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700">Salud de Proyectos</h3>
                  <span className="ml-auto">
                    <HealthBadge level={health.portfolio_level} score={health.portfolio_score} size="sm" />
                  </span>
                </div>
                <div className="space-y-2.5">
                  {health.projects.map((p) => (
                    <button
                      key={p.project_id}
                      onClick={() => router.push(`/proyectos/${p.project_id}`)}
                      className="w-full flex items-center gap-3 group hover:bg-gray-50 rounded-lg px-1 py-1 transition-colors"
                      title={p.factors
                        .filter((f) => f.penalty > 0)
                        .map((f) => `${f.label}: −${f.penalty}`)
                        .join(' · ')}
                    >
                      <span className="text-xs text-gray-600 flex-1 truncate text-left group-hover:text-gray-900">
                        {p.project_name}
                      </span>
                      <div className="w-28">
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              p.level === 'green' ? 'bg-emerald-500' : p.level === 'yellow' ? 'bg-amber-400' : 'bg-red-500'
                            }`}
                            style={{ width: `${p.score}%` }}
                          />
                        </div>
                      </div>
                      <HealthBadge level={p.level} score={p.score} size="sm" />
                    </button>
                  ))}
                  {health.projects.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin proyectos activos</p>
                  )}
                </div>
              </div>
            )}

            {capacity && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Gauge size={16} className="text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700">Capacidad del Equipo</h3>
                  <button
                    onClick={() => router.push('/capacidad')}
                    className="ml-auto text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Ver todo →
                  </button>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <p
                    className={`text-2xl font-bold ${
                      capacity.summary.status === 'overloaded'
                        ? 'text-red-600'
                        : capacity.summary.status === 'high'
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {capacity.summary.utilization_pct.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    utilización semanal · {capacity.summary.active_points} de{' '}
                    {capacity.summary.capacity_points} pts ·{' '}
                    {capacity.summary.overloaded_users} sobrecargado(s)
                  </p>
                </div>
                <div className="space-y-2">
                  {capacity.users.slice(0, 5).map((u) => (
                    <div key={u.user_id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-32 shrink-0 truncate">{u.user_name}</span>
                      <div className="flex-1">
                        <CapacityBar utilizationPct={u.utilization_pct} status={u.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Row 2: Mini bar charts CSS puro ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gráfica 1: Distribución por Estado */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Distribución por Estado</h3>
              <span className="text-[10px] text-gray-400 ml-auto">Clic para filtrar</span>
            </div>
            <div className="space-y-2.5">
              {Object.entries(STATUS_INFO)
                .map(([key, info]) => ({ key, ...info, count: byStatus[key] ?? 0 }))
                .filter((s) => s.count > 0)
                .sort((a, b) => b.count - a.count)
                .map(({ key, label, color, count }) => (
                  <button
                    key={key}
                    onClick={() => router.push(filterToUrl(`status_${key}` as PanelFilter))}
                    className="w-full flex items-center gap-3 group hover:bg-gray-50 rounded-lg px-1 py-0.5 transition-colors"
                  >
                    <span className="text-xs text-gray-500 w-32 shrink-0 truncate text-left group-hover:text-gray-800">
                      {label}
                    </span>
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${color} group-hover:brightness-90`}
                          style={{ width: `${(count / statusTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Gráfica 2: Avance por Rol */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Avance por Rol</h3>
              <span className="text-[10px] text-gray-400 ml-auto">% completado</span>
            </div>
            {roleDetail.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {[...roleDetail]
                  .sort((a, b) => {
                    const pctA = a.total > 0 ? (a.approved / a.total) * 100 : 0;
                    const pctB = b.total > 0 ? (b.approved / b.total) * 100 : 0;
                    return pctB - pctA;
                  })
                  .map((r) => {
                    const pct = r.total > 0 ? Math.round((r.approved / r.total) * 100) : 0;
                    const barColor = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-blue-400' : 'bg-[#194276]/60';
                    return (
                      <button
                        key={r.role}
                        onClick={() => router.push(filterToUrl(`role_${r.role}` as PanelFilter))}
                        className="w-full flex items-center gap-3 group hover:bg-gray-50 rounded-lg px-1 py-0.5 transition-colors"
                      >
                        <span className="text-xs text-gray-600 w-24 shrink-0 text-left group-hover:text-gray-800">
                          {ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}
                        </span>
                        <div className="flex-1">
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all ${barColor} group-hover:brightness-90`}
                              style={{ width: `${pct > 0 ? pct : 4}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-right w-24 shrink-0 justify-end">
                          <span className="font-semibold text-gray-700">{pct}%</span>
                          {r.overdue > 0 && (
                            <span className="text-red-500 font-medium">({r.overdue} venc.)</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3: Global ring + Program progress ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Global compliance ring */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-8">
            <div
              onClick={() => router.push('/entregables')}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              title="Ver todos los entregables"
            >
              <GlobalRing value={Math.round(globalPct)} />
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Avance global de la organización</p>
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Total entregables</span>
                  <span className="font-semibold">{d.total_deliverables}</span>
                </div>
                <div className="flex justify-between">
                  <span>Finalizados</span>
                  <span className="font-semibold text-emerald-600">{d.finished_deliverables}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vencidos</span>
                  <span className="font-semibold text-red-600">{d.overdue_activities}</span>
                </div>
                <div className="flex justify-between">
                  <span>Con observaciones</span>
                  <span className="font-semibold text-amber-600">{d.with_observations}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Program progress bars */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Avance por programa</h3>
            </div>
            {programs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin datos de programas</p>
            ) : (
              <div className="space-y-4">
                {byProgress.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/entregables?filter=program_${p.id}`)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors rounded-lg p-1 -mx-1"
                  >
                    <div className="flex justify-between items-end mb-1">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{p.project_name}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-700 ml-3 shrink-0">{p.compliance_percentage}%</span>
                    </div>
                    <ProgressBar value={p.compliance_percentage} color={progressColor(p.compliance_percentage)} />
                    <div className="flex gap-3 mt-1 text-[10px] text-gray-400 items-center">
                      <span>{p.finished}/{p.total} finalizados</span>
                      {p.overdue_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 bg-red-50 text-red-600 font-semibold rounded-full px-1.5 py-0.5">
                          {p.overdue_count} vencidas
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Flow bottleneck + Rankings ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Flow bottleneck by role */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Carga por etapa del flujo</h3>
              <span className="text-[10px] text-gray-400 ml-auto">Actividades activas</span>
            </div>
            {roleDetail.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin datos de flujo</p>
            ) : (
              <div className="space-y-3">
                {[...roleDetail]
                  .sort((a, b) => b.active - a.active)
                  .map((r) => (
                    <div key={r.role} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-24 shrink-0">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}</span>
                      <div className="flex-1">
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-2.5 rounded-full bg-blue-400"
                            style={{ width: `${r.active > 0 ? (r.active / maxActive) * 100 : 3}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-right w-28 shrink-0 justify-end">
                        <span className="font-semibold text-gray-700">{r.active} activas</span>
                        {r.overdue > 0 && (
                          <span className="inline-flex items-center gap-0.5 bg-red-50 text-red-600 font-semibold rounded-full px-1.5 py-0.5 text-[10px]">
                            {r.overdue} venc.
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-4">
              · Barras rojas indican etapas con actividades vencidas — posibles cuellos de botella
            </p>
          </div>

          {/* Rankings */}
          <div className="space-y-4">
            {byOverdue.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle size={16} className="text-red-400" />
                  <h3 className="text-sm font-semibold text-gray-700">Programas con más vencimientos</h3>
                </div>
                <div className="space-y-3">
                  {byOverdue.slice(0, 5).map((p, idx) => (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/entregables?filter=program_${p.id}`)}
                      className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors rounded-lg px-1 py-0.5 -mx-1"
                    >
                      <span className="text-xs text-gray-400 w-4 shrink-0">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{p.project_name}</p>
                      </div>
                      <span className="text-sm font-bold text-red-600 shrink-0">{p.overdue_count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-gray-700">Programas con menor avance</h3>
              </div>
              <div className="space-y-3">
                {[...programs]
                  .sort((a, b) => a.compliance_percentage - b.compliance_percentage)
                  .slice(0, 5)
                  .map((p, idx) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4 shrink-0">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{p.project_name}</p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${progressColor(p.compliance_percentage).replace('bg-', 'text-')}`}>
                        {p.compliance_percentage}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 5: Carga de Trabajo por Usuario ── */}
        {workload.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Carga de Trabajo</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">Distribución por usuario</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-gray-500 font-medium pb-2 pr-3">Usuario</th>
                    <th className="text-left text-gray-500 font-medium pb-2 pr-3">Rol</th>
                    <th className="text-center text-gray-500 font-medium pb-2 pr-3">Total</th>
                    <th className="text-center text-gray-500 font-medium pb-2 pr-3">En Proceso</th>
                    <th className="text-center text-gray-500 font-medium pb-2 pr-3">Vencidas</th>
                    <th className="text-center text-gray-500 font-medium pb-2 pr-3">Completadas</th>
                    <th className="text-left text-gray-500 font-medium pb-2">Progreso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {workload.slice(0, workloadExpanded ? workload.length : WORKLOAD_COMPACT).map((u) => {
                    const inProcess = u.pending + u.in_review;
                    const completedPct = u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0;
                    const barColor = completedPct >= 70 ? 'bg-emerald-500' : completedPct >= 40 ? 'bg-amber-400' : 'bg-red-400';
                    const roleLabel = ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role;
                    const initial = u.user_name.charAt(0).toUpperCase();
                    return (
                      <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                              style={{ backgroundColor: '#194276' }}
                            >
                              {initial}
                            </div>
                            <span className="font-medium text-gray-800 truncate max-w-[120px]">{u.user_name}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="inline-block bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">
                            {roleLabel}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-center font-semibold text-gray-700">{u.total}</td>
                        <td className="py-2 pr-3 text-center text-gray-600">{inProcess}</td>
                        <td className="py-2 pr-3 text-center">
                          {u.overdue > 0 ? (
                            <span className="inline-block bg-red-50 text-red-600 font-semibold rounded-full px-2 py-0.5">
                              {u.overdue}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <span className="inline-block bg-emerald-50 text-emerald-700 font-semibold rounded-full px-2 py-0.5">
                            {u.completed}
                          </span>
                        </td>
                        <td className="py-2 min-w-[100px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all ${barColor}`}
                                style={{ width: `${completedPct}%` }}
                              />
                            </div>
                            <span className="text-gray-500 w-8 text-right shrink-0">{completedPct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {workload.length > WORKLOAD_COMPACT && (
              <button
                onClick={() => setWorkloadExpanded(e => !e)}
                className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                {workloadExpanded ? 'Ver menos' : `Ver ${workload.length - WORKLOAD_COMPACT} usuarios más`}
              </button>
            )}
          </div>
        )}
      </div>

    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="p-6">
        <StatsSkeleton />
      </div>
    );
  }

  const isAdmin = user && ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number]);
  return isAdmin ? <DashboardAdmin /> : <DashboardOperativo />;
}
