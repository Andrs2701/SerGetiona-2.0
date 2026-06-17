'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban, BookOpen, Activity, XCircle, CheckCircle2,
  TrendingUp, AlertTriangle, BarChart3, Users, Clock, Package,
  MessageSquare, X, CalendarDays, Gauge, LayoutDashboard,
  GitBranch, FileBarChart, ChevronDown,
} from 'lucide-react';
import DashboardOperativo from '@/components/DashboardOperativo';
import { StatsSkeleton } from '@/components/LoadingSkeleton';
import HealthBadge from '@/components/HealthBadge';
import CapacityBar from '@/components/CapacityBar';
import { api, ENDPOINTS } from '@/lib/api';
import type {
  DashboardStats, ProgramBreakdown, ActivityByRoleDetail,
  HealthReport, CapacitySummary, CapacityUser,
} from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const ADMIN_ROLES = ['admin', 'coordinator'] as const;

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_INFO: Record<string, { label: string; color: string; tw: string }> = {
  finished:          { label: 'Finalizado',       color: '#10b981', tw: 'bg-emerald-500' },
  in_progress:       { label: 'En Ejecución',      color: '#3b82f6', tw: 'bg-blue-500' },
  in_review:         { label: 'En Revisión',       color: '#8b5cf6', tw: 'bg-purple-500' },
  with_observations: { label: 'Con Observaciones', color: '#f59e0b', tw: 'bg-amber-400' },
  pending_start:     { label: 'Pend. Inicio',      color: '#9ca3af', tw: 'bg-gray-400' },
  unpublished:       { label: 'Sin Publicar',      color: '#d1d5db', tw: 'bg-gray-300' },
  cancelled:         { label: 'Cancelado',         color: '#fca5a5', tw: 'bg-red-300' },
  not_applicable:    { label: 'No Aplica',         color: '#cbd5e1', tw: 'bg-slate-300' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function progressColor(pct: number) {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

function ProgressBar({ value, color = 'bg-indigo-500' }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function GlobalRing({ value }: { value: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width="144" height="144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-gray-700" />
        <circle cx="72" cy="72" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}%</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Avance</p>
      </div>
    </div>
  );
}

// ─── Card shared ─────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {children}
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type DashTab = 'resumen' | 'seguimiento' | 'capacidad' | 'reportes';

const TABS: { id: DashTab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen',     label: 'Resumen',     icon: LayoutDashboard },
  { id: 'seguimiento', label: 'Seguimiento', icon: GitBranch },
  { id: 'capacidad',   label: 'Capacidad',   icon: Gauge },
  { id: 'reportes',    label: 'Reportes',    icon: FileBarChart },
];

// ─── Panel filter types ───────────────────────────────────────────────────────

type PanelFilter =
  | 'active_projects' | 'programs' | 'total_deliverables' | 'overdue'
  | 'approaching' | 'with_observations'
  | `status_${string}` | `role_${string}`;

interface PanelRow {
  id: number; name: string; responsible?: string; program?: string;
  subject?: string; commitment_date?: string; days_diff?: number; status?: string; role?: string;
}

function formatDateStr(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function filterToUrl(filter: PanelFilter): string {
  if (filter === 'overdue')           return '/entregables?filter=overdue';
  if (filter === 'approaching')       return '/entregables?filter=approaching';
  if (filter === 'with_observations') return '/entregables?filter=with_observations';
  if (filter === 'total_deliverables') return '/entregables';
  if (filter === 'active_projects')   return '/proyectos';
  if (filter === 'programs')          return '/programas';
  if (filter.startsWith('status_'))   return `/entregables?filter=${filter}`;
  if (filter.startsWith('role_'))     return `/entregables?filter=${filter}`;
  return '/entregables';
}

// ─── SlidingPanel ─────────────────────────────────────────────────────────────

function SlidingPanel({ filter, onClose }: { filter: PanelFilter | null; onClose: () => void }) {
  const [rows, setRows] = useState<PanelRow[]>([]);
  const [loadingPanel, setLoadingPanel] = useState(false);

  const fetchRows = useCallback(async (f: PanelFilter) => {
    setLoadingPanel(true);
    try {
      let endpoint = '/deliverables';
      const params: Record<string, string> = {};
      if (f === 'overdue')           { endpoint = '/reports/compliance'; params['date_status'] = 'overdue'; }
      else if (f === 'approaching')  { endpoint = '/reports/compliance'; params['date_status'] = 'approaching'; }
      else if (f === 'with_observations') { params['status'] = 'with_observations'; }
      else if (f.startsWith('status_'))   { params['status'] = f.replace('status_', ''); }
      const query = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await api.get<any[]>(endpoint + query);
      if (Array.isArray(data) && data.length > 0) {
        setRows(data.map((item, idx) => ({
          id: item.id ?? idx,
          name: item.name ?? item.deliverable?.name ?? '—',
          responsible: item.responsible ?? item.user?.name ?? '—',
          program: item.program?.name ?? '—',
          subject: item.subject?.name ?? '—',
          commitment_date: item.commitment_date ?? item.due_date,
          days_diff: item.commitment_date
            ? Math.round((new Date(item.commitment_date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)
            : undefined,
          status: item.status ?? item.date_status,
          role: item.role,
        })));
      } else { setRows([]); }
    } catch { setRows([]); }
    finally { setLoadingPanel(false); }
  }, []);

  useEffect(() => { if (filter) fetchRows(filter); }, [filter, fetchRows]);

  const visible = filter !== null;
  const panelTitle = (() => {
    if (!filter) return '';
    const map: Record<string, string> = {
      active_projects: 'Proyectos Activos', programs: 'Programas',
      total_deliverables: 'Total Entregables', overdue: 'Actividades Vencidas',
      approaching: 'Por Vencer', with_observations: 'Con Observaciones',
    };
    if (map[filter]) return map[filter];
    if (filter.startsWith('status_')) return STATUS_INFO[filter.replace('status_', '')]?.label ?? filter;
    if (filter.startsWith('role_'))   return `Rol: ${ROLE_LABELS[filter.replace('role_', '') as keyof typeof ROLE_LABELS] ?? filter}`;
    return filter;
  })();

  return (
    <>
      {visible && <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />}
      <div className={`fixed right-0 top-0 h-full w-[480px] bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col transition-transform duration-300 ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Detalle filtrado</p>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">{panelTitle}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-400">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loadingPanel ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl h-20 animate-pulse" />)}</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2 py-20">
              <CheckCircle2 size={36} className="text-emerald-300" />
              <p>Sin registros para este filtro</p>
            </div>
          ) : rows.map((row) => {
            const isOverdue    = (row.days_diff ?? 0) < 0;
            const isApproach   = !isOverdue && (row.days_diff ?? 99) <= 3;
            const borderCls    = isOverdue ? 'border-l-4 border-l-red-400' : isApproach ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-blue-100 dark:border-l-blue-900';
            return (
              <div key={row.id} className={`bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${borderCls}`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">{row.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {row.responsible && <span className="flex items-center gap-1"><Users size={10} /><span className="truncate">{row.responsible}</span></span>}
                  {row.program && <span className="flex items-center gap-1 truncate"><BookOpen size={10} /><span className="truncate">{row.program}</span></span>}
                  {row.commitment_date && <span className="flex items-center gap-1"><CalendarDays size={10} />{formatDateStr(row.commitment_date)}</span>}
                </div>
                {row.days_diff !== undefined && (
                  <div className="mt-2">
                    {isOverdue ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-full px-2 py-0.5">
                        <XCircle size={10} /> Vencida hace {Math.abs(row.days_diff)} día(s)
                      </span>
                    ) : isApproach ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5">
                        <AlertTriangle size={10} /> Vence en {row.days_diff} día(s)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 dark:bg-gray-700 rounded-full px-2 py-0.5">
                        <Clock size={10} /> {row.days_diff} días restantes
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <p className="text-xs text-gray-400 text-center">{rows.length} registros encontrados</p>
        </div>
      </div>
    </>
  );
}

// ─── TAB: RESUMEN ─────────────────────────────────────────────────────────────

interface WorkloadUser {
  user_id: number; user_name: string; role: string;
  total: number; pending: number; in_review: number; overdue: number; completed: number;
}

function TabResumen({
  stats, health, capacity, workload, onFilter,
}: {
  stats: DashboardStats;
  health: HealthReport | null;
  capacity: { summary: CapacitySummary; users: CapacityUser[] } | null;
  workload: WorkloadUser[];
  onFilter: (f: PanelFilter) => void;
}) {
  const router = useRouter();
  const d = stats;
  const globalPct = d.global_compliance_percentage ?? d.compliance_percentage ?? 0;
  const programs: ProgramBreakdown[] = d.programs_breakdown ?? [];
  const roleDetail: ActivityByRoleDetail[] = d.activities_by_role_detail ?? [];
  const byStatus = d.deliverables_by_status ?? {};
  const byProgress = [...programs].sort((a, b) => b.compliance_percentage - a.compliance_percentage);
  const maxActive = Math.max(...roleDetail.map(r => r.active), 1);
  const statusTotal = Object.values(byStatus).reduce((s, v) => s + v, 0) || 1;

  const kpiCards = [
    { label: 'Proyectos Activos', value: d.active_projects,       icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', ring: 'hover:ring-indigo-300', filter: 'active_projects' as PanelFilter, highlight: false },
    { label: 'Programas',         value: d.total_programs,        icon: BookOpen,     color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'hover:ring-emerald-300', filter: 'programs' as PanelFilter, highlight: false },
    { label: 'Total Entregables', value: d.total_deliverables,    icon: Package,      color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', ring: 'hover:ring-amber-300', filter: 'total_deliverables' as PanelFilter, highlight: false },
    { label: 'Vencidas',          value: d.overdue_activities,    icon: XCircle,      color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', ring: 'hover:ring-red-300', filter: 'overdue' as PanelFilter, highlight: (d.overdue_activities ?? 0) > 0 },
    { label: 'Por Vencer',        value: d.approaching_activities,icon: AlertTriangle,color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', ring: 'hover:ring-orange-300', filter: 'approaching' as PanelFilter, highlight: false },
    { label: 'Con Observaciones', value: d.with_observations,     icon: MessageSquare,color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', ring: 'hover:ring-purple-300', filter: 'with_observations' as PanelFilter, highlight: false },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, color, bg, ring, highlight, filter }) => (
          <button key={label} onClick={() => onFilter(filter)}
            className={`rounded-xl border p-4 flex flex-col gap-2 text-left transition-all cursor-pointer ring-2 ring-transparent ${ring} hover:shadow-md active:scale-95 ${highlight ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            <div className={`${bg} rounded-lg p-2 self-start`}><Icon className={`${color} w-4 h-4`} /></div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
          </button>
        ))}
      </div>

      {/* Health + Capacity */}
      {(health || capacity) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {health && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Salud de Proyectos</h3>
                <span className="ml-auto"><HealthBadge level={health.portfolio_level} score={health.portfolio_score} size="sm" /></span>
              </div>
              <div className="space-y-2.5">
                {health.projects.map(p => (
                  <button key={p.project_id} onClick={() => router.push(`/proyectos/${p.project_id}`)}
                    className="w-full flex items-center gap-3 group hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-1 py-1 transition-colors">
                    <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate text-left group-hover:text-gray-900 dark:group-hover:text-gray-100">{p.project_name}</span>
                    <div className="w-28">
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${p.level === 'green' ? 'bg-emerald-500' : p.level === 'yellow' ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${p.score}%` }} />
                      </div>
                    </div>
                    <HealthBadge level={p.level} score={p.score} size="sm" />
                  </button>
                ))}
                {health.projects.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin proyectos activos</p>}
              </div>
            </Card>
          )}
          {capacity && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Gauge size={16} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Capacidad del Equipo</h3>
                <button onClick={() => router.push('/capacidad')} className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">Ver todo →</button>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <p className={`text-2xl font-bold ${capacity.summary.status === 'overloaded' ? 'text-red-600' : capacity.summary.status === 'high' ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {capacity.summary.utilization_pct.toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  utilización · {capacity.summary.active_points} / {capacity.summary.capacity_points} pts · {capacity.summary.overloaded_users} sobrecargado(s)
                </p>
              </div>
              <div className="space-y-2">
                {capacity.users.slice(0, 5).map(u => (
                  <div key={u.user_id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-32 shrink-0 truncate">{u.user_name}</span>
                    <div className="flex-1"><CapacityBar utilizationPct={u.utilization_pct} status={u.status} /></div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Estado + Rol progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Distribución por Estado</h3>
            <span className="text-[10px] text-gray-400 ml-auto">Clic para filtrar</span>
          </div>
          <div className="space-y-2.5">
            {Object.entries(STATUS_INFO)
              .map(([key, info]) => ({ key, ...info, count: byStatus[key] ?? 0 }))
              .filter(s => s.count > 0).sort((a, b) => b.count - a.count)
              .map(({ key, label, tw, count }) => (
                <button key={key} onClick={() => onFilter(`status_${key}` as PanelFilter)}
                  className="w-full flex items-center gap-3 group hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-1 py-0.5 transition-colors">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-32 shrink-0 truncate text-left">{label}</span>
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full transition-all ${tw}`} style={{ width: `${(count / statusTotal) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-6 text-right">{count}</span>
                </button>
              ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Avance por Rol</h3>
            <span className="text-[10px] text-gray-400 ml-auto">% completado</span>
          </div>
          {roleDetail.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Sin datos</p> : (
            <div className="space-y-3">
              {[...roleDetail].sort((a, b) => {
                const pA = a.total > 0 ? a.approved / a.total : 0;
                const pB = b.total > 0 ? b.approved / b.total : 0;
                return pB - pA;
              }).map(r => {
                const pct = r.total > 0 ? Math.round((r.approved / r.total) * 100) : 0;
                const bar = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-blue-400' : 'bg-indigo-900/60';
                return (
                  <button key={r.role} onClick={() => onFilter(`role_${r.role}` as PanelFilter)}
                    className="w-full flex items-center gap-3 group hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-1 py-0.5 transition-colors">
                    <span className="text-xs text-gray-600 dark:text-gray-400 w-24 shrink-0 text-left">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}</span>
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-2.5 rounded-full transition-all ${bar}`} style={{ width: `${pct > 0 ? pct : 4}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs w-24 shrink-0 justify-end">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
                      {r.overdue > 0 && <span className="text-red-500 font-medium">({r.overdue} venc.)</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Global ring + Programs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="flex items-center gap-8">
          <div className="cursor-pointer hover:opacity-80" onClick={() => router.push('/entregables')}>
            <GlobalRing value={Math.round(globalPct)} />
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Avance global de la organización</p>
            <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between"><span>Total entregables</span><span className="font-semibold">{d.total_deliverables}</span></div>
              <div className="flex justify-between"><span>Finalizados</span><span className="font-semibold text-emerald-600">{d.finished_deliverables}</span></div>
              <div className="flex justify-between"><span>Vencidos</span><span className="font-semibold text-red-600">{d.overdue_activities}</span></div>
              <div className="flex justify-between"><span>Con observaciones</span><span className="font-semibold text-amber-600">{d.with_observations}</span></div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Avance por programa</h3>
          </div>
          {programs.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Sin datos</p> : (
            <div className="space-y-4">
              {byProgress.map(p => (
                <div key={p.id} onClick={() => router.push(`/entregables?filter=program_${p.id}`)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg p-1 -mx-1 transition-colors">
                  <div className="flex justify-between items-end mb-1">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{p.project_name}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 ml-3 shrink-0">{p.compliance_percentage}%</span>
                  </div>
                  <ProgressBar value={p.compliance_percentage} color={progressColor(p.compliance_percentage)} />
                  <div className="flex gap-3 mt-1 text-[10px] text-gray-400 items-center">
                    <span>{p.finished}/{p.total} finalizados</span>
                    {p.overdue_count > 0 && <span className="bg-red-50 dark:bg-red-900/20 text-red-600 font-semibold rounded-full px-1.5 py-0.5">{p.overdue_count} vencidas</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Workload table */}
      {workload.length > 0 && <WorkloadTable workload={workload} />}
    </div>
  );
}

// ─── WorkloadTable ────────────────────────────────────────────────────────────

const WORKLOAD_COMPACT = 5;
function WorkloadTable({ workload }: { workload: WorkloadUser[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Users size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Carga de Trabajo</h3>
      </div>
      <p className="text-xs text-gray-400 mb-4">Distribución por usuario</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              {['Usuario','Rol','Total','En Proceso','Vencidas','Completadas','Progreso'].map(h => (
                <th key={h} className={`text-gray-500 dark:text-gray-400 font-medium pb-2 pr-3 ${h === 'Usuario' ? 'text-left' : 'text-center'} ${h === 'Progreso' ? 'text-left' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {workload.slice(0, expanded ? workload.length : WORKLOAD_COMPACT).map(u => {
              const inProcess = u.pending + u.in_review;
              const pct = u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0;
              const bar = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
              return (
                <tr key={u.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0" style={{ backgroundColor: '#194276' }}>
                        {u.user_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px]">{u.user_name}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-center font-semibold text-gray-700 dark:text-gray-300">{u.total}</td>
                  <td className="py-2 pr-3 text-center text-gray-600 dark:text-gray-400">{inProcess}</td>
                  <td className="py-2 pr-3 text-center">
                    {u.overdue > 0 ? <span className="bg-red-50 dark:bg-red-900/20 text-red-600 font-semibold rounded-full px-2 py-0.5">{u.overdue}</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-2 pr-3 text-center">
                    <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-semibold rounded-full px-2 py-0.5">{u.completed}</span>
                  </td>
                  <td className="py-2 min-w-[100px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-gray-500 dark:text-gray-400 w-8 text-right shrink-0">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {workload.length > WORKLOAD_COMPACT && (
        <button onClick={() => setExpanded(e => !e)} className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium">
          {expanded ? 'Ver menos' : `Ver ${workload.length - WORKLOAD_COMPACT} usuarios más`}
        </button>
      )}
    </Card>
  );
}

// ─── TAB: SEGUIMIENTO (Gantt) ─────────────────────────────────────────────────

interface GanttDeliverable {
  id: number; name: string; start_date?: string; commitment_date?: string;
  global_status: string; project_name?: string; program_name?: string;
}

interface Project { id: number; name: string; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDeliv(item: any): GanttDeliverable {
  return {
    id: item.id,
    name: item.name ?? '—',
    start_date: item.start_date,
    commitment_date: item.commitment_date ?? item.activities?.[item.activities?.length - 1]?.commitment_date,
    global_status: item.global_status ?? 'pending_start',
    project_name: item.subject?.academic_program?.project?.name ?? item.project_name ?? '',
    program_name: item.subject?.academic_program?.name ?? item.program_name ?? '',
  };
}

const WEEK_PX = 110;
const WEEKS_BACK = 2;
const WEEKS_FWD  = 6;
const TOTAL_WEEKS = WEEKS_BACK + WEEKS_FWD + 1;

function getMonday(d: Date) {
  const day = d.getDay() || 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + 1);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function TabSeguimiento({ projects }: { projects: Project[] }) {
  const [selectedProject, setSelectedProject] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [deliverables, setDeliverables] = useState<GanttDeliverable[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = getMonday(today);
  const ganttStart = addDays(monday, -WEEKS_BACK * 7);
  const totalPx = TOTAL_WEEKS * WEEK_PX;

  const dateToX = (d: Date) => ((d.getTime() - ganttStart.getTime()) / (1000 * 60 * 60 * 24 * 7)) * WEEK_PX;
  const todayX = dateToX(today);

  const weekLabels = Array.from({ length: TOTAL_WEEKS }, (_, i) => addDays(ganttStart, i * 7));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '40' };
      if (selectedProject) params['project_id'] = String(selectedProject);
      if (selectedStatus)  params['status']     = selectedStatus;
      const q = '?' + new URLSearchParams(params).toString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await api.get<any>(ENDPOINTS.DELIVERABLES + q);
      const arr: GanttDeliverable[] = (Array.isArray(raw) ? raw : raw?.data ?? []).map(parseDeliv);
      setDeliverables(arr);
    } catch { setDeliverables([]); }
    finally { setLoading(false); }
  }, [selectedProject, selectedStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group by project
  const groups = deliverables.reduce<Record<string, GanttDeliverable[]>>((acc, d) => {
    const key = d.project_name || 'Sin proyecto';
    (acc[key] = acc[key] ?? []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="py-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <FolderKanban size={14} className="text-gray-400" />
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value === '' ? '' : Number(e.target.value))}
              className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">Todos los proyectos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-gray-400" />
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            {Object.entries(STATUS_INFO).filter(([, v]) => ['finished','in_progress','in_review','with_observations','pending_start'].includes(v.label !== '' ? Object.keys(STATUS_INFO).find(k => STATUS_INFO[k] === v) ?? '' : '')).slice(0,5).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm inline-block ${v.tw}`} />{v.label}</span>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex gap-4 mt-3 flex-wrap text-xs text-gray-500 dark:text-gray-400">
          {Object.entries(STATUS_INFO).slice(0,6).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`w-3 h-2 rounded-sm inline-block ${v.tw}`} />{v.label}
            </span>
          ))}
        </div>
      </Card>

      {/* Gantt */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${220 + totalPx}px` }}>
            {/* Header */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <div className="w-52 shrink-0 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                Entregable / Programa
              </div>
              <div className="flex relative" style={{ width: `${totalPx}px` }}>
                {weekLabels.map((d, i) => {
                  const isCurrentWeek = i === WEEKS_BACK;
                  return (
                    <div key={i} className={`flex-shrink-0 text-center py-3 border-r border-gray-200 dark:border-gray-700 ${isCurrentWeek ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`} style={{ width: `${WEEK_PX}px` }}>
                      <p className={`text-[10px] font-semibold ${isCurrentWeek ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-500'}`}>
                        {d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      </p>
                      <p className={`text-[10px] ${isCurrentWeek ? 'text-indigo-500 dark:text-indigo-400 font-semibold' : 'text-gray-400'}`}>
                        {isCurrentWeek ? 'ESTA SEM.' : `Sem ${i + 1}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows */}
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Cargando datos...</div>
            ) : Object.keys(groups).length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400 dark:text-gray-500">Sin entregables para los filtros seleccionados.</div>
            ) : (
              Object.entries(groups).map(([projectName, items]) => (
                <div key={projectName}>
                  {/* Project header row */}
                  <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60">
                    <div className="w-52 shrink-0 px-4 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 border-r border-gray-200 dark:border-gray-700 truncate flex items-center gap-1.5">
                      <FolderKanban size={12} />{projectName}
                    </div>
                    <div style={{ width: `${totalPx}px` }} />
                  </div>

                  {/* Deliverable rows */}
                  {items.map(deliv => {
                    const startDate = deliv.start_date ? new Date(deliv.start_date + 'T00:00:00') : null;
                    const endDate   = deliv.commitment_date ? new Date(deliv.commitment_date + 'T00:00:00')
                                    : startDate ? addDays(startDate, 28) : null;
                    const statusCfg = STATUS_INFO[deliv.global_status] ?? { color: '#9ca3af', tw: 'bg-gray-400', label: deliv.global_status };

                    let barLeft = 0, barWidth = 0;
                    if (startDate && endDate) {
                      const rawLeft = dateToX(startDate);
                      const rawRight = dateToX(endDate);
                      barLeft  = Math.max(0, Math.min(rawLeft, totalPx - 4));
                      barWidth = Math.max(6, Math.min(rawRight, totalPx) - barLeft);
                    }

                    return (
                      <div key={deliv.id} className="flex border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group relative">
                        <div className="w-52 shrink-0 px-4 py-2.5 border-r border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{deliv.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{deliv.program_name}</p>
                        </div>
                        <div className="relative flex items-center" style={{ width: `${totalPx}px`, height: '44px' }}>
                          {/* Week grid lines */}
                          {weekLabels.map((_, i) => (
                            <div key={i} className={`absolute top-0 bottom-0 border-r border-gray-100 dark:border-gray-700/40 ${i === WEEKS_BACK ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                              style={{ left: `${i * WEEK_PX}px`, width: `${WEEK_PX}px` }} />
                          ))}
                          {/* Today line */}
                          {todayX >= 0 && todayX <= totalPx && (
                            <div className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none" style={{ left: `${todayX}px` }} />
                          )}
                          {/* Bar */}
                          {startDate && endDate && barWidth > 0 && (
                            <div
                              className={`absolute rounded-full ${statusCfg.tw} opacity-80 group-hover:opacity-100 transition-opacity cursor-default`}
                              style={{ left: `${barLeft}px`, width: `${barWidth}px`, height: '18px', top: '13px' }}
                              title={`${deliv.name} — ${statusCfg.label}`}
                            />
                          )}
                          {!startDate && (
                            <div className="absolute left-2 text-[10px] text-gray-400 italic">Sin fecha</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}

            {/* Today line label at top */}
            {todayX >= 0 && todayX <= totalPx && (
              <div className="relative h-0 pointer-events-none" style={{ marginTop: '-100%' }}>
                <div className="absolute" style={{ left: `${220 + todayX}px`, top: 0 }}>
                  <span className="bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded">HOY</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-400 flex items-center justify-between">
          <span>{deliverables.length} entregables mostrados</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Línea roja = hoy</span>
        </div>
      </Card>
    </div>
  );
}

// ─── TAB: CAPACIDAD ───────────────────────────────────────────────────────────

function TabCapacidad({ capacity }: { capacity: { summary: CapacitySummary; users: CapacityUser[] } | null }) {
  const router = useRouter();
  if (!capacity) return (
    <Card><p className="text-sm text-gray-400 text-center py-8">Sin datos de capacidad.</p></Card>
  );

  const { summary, users } = capacity;
  const summaryCards = [
    { label: 'Puntos activos',    value: summary.active_points,   color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Puntos disponibles',value: summary.available_points, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Capacidad total',   value: summary.capacity_points,  color: 'text-gray-700',    bg: 'bg-gray-100 dark:bg-gray-700' },
    { label: 'Sobrecargados',     value: summary.overloaded_users, color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20' },
  ];

  // Simple SVG bar chart for users
  const maxPct = Math.max(...users.map(u => u.utilization_pct), 100);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, color, bg }) => (
          <Card key={label} className="py-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
          </Card>
        ))}
      </div>

      {/* Utilization gauge */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Utilización Global</h3>
            <p className="text-xs text-gray-400 mt-0.5">Semana actual</p>
          </div>
          <button onClick={() => router.push('/capacidad')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Ver módulo completo →</button>
        </div>
        {/* SVG bar chart: users by utilization */}
        <div className="space-y-3">
          {users.map(u => {
            const overloaded = u.status === 'overloaded';
            const high       = u.status === 'high';
            const barColor   = overloaded ? '#ef4444' : high ? '#f59e0b' : '#10b981';
            const pct        = Math.round(u.utilization_pct);
            return (
              <div key={u.user_id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: '#194276' }}>
                  {u.user_name.charAt(0).toUpperCase()}
                </div>
                <div className="w-32 shrink-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{u.user_name}</p>
                  <p className="text-[10px] text-gray-400">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</p>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(100, (pct / maxPct) * 100)}%`, backgroundColor: barColor }} />
                  </div>
                  <span className={`text-xs font-semibold w-12 text-right ${overloaded ? 'text-red-600' : high ? 'text-amber-600' : 'text-emerald-600'}`}>{pct}%</span>
                </div>
                <div className="text-[10px] text-gray-400 w-28 shrink-0 text-right">
                  {u.active_points} / {u.capacity_points} pts
                  {u.overdue > 0 && <span className="text-red-500 ml-1">· {u.overdue} venc.</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* By role summary */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Utilización por Rol</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(ROLE_LABELS).map(([role, label]) => {
            const roleUsers = users.filter(u => u.role === role);
            if (roleUsers.length === 0) return null;
            const avg = Math.round(roleUsers.reduce((s, u) => s + u.utilization_pct, 0) / roleUsers.length);
            const overloaded = roleUsers.filter(u => u.status === 'overloaded').length;
            return (
              <div key={role} className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
                  {overloaded > 0 && <span className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full px-1.5 py-0.5 font-semibold">{overloaded} sobrecargado(s)</span>}
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden mb-1">
                  <div className="h-2 rounded-full" style={{ width: `${Math.min(100, avg)}%`, backgroundColor: avg > 100 ? '#ef4444' : avg >= 80 ? '#f59e0b' : '#10b981' }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>{roleUsers.length} usuario(s)</span>
                  <span className="font-semibold">{avg}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── TAB: REPORTES ────────────────────────────────────────────────────────────

function TabReportes({
  stats, workload, health,
}: {
  stats: DashboardStats | null;
  workload: WorkloadUser[];
  health: HealthReport | null;
}) {
  const router = useRouter();
  if (!stats) return <Card><p className="text-sm text-gray-400 text-center py-8">Sin datos.</p></Card>;

  const programs: ProgramBreakdown[] = stats.programs_breakdown ?? [];
  const roleDetail: ActivityByRoleDetail[] = stats.activities_by_role_detail ?? [];
  const byStatus = stats.deliverables_by_status ?? {};
  const maxRole = Math.max(...roleDetail.map(r => r.total), 1);
  const statusTotal = Object.values(byStatus).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Cumplimiento global',     value: `${Math.round(stats.global_compliance_percentage ?? stats.compliance_percentage ?? 0)}%`, color: 'text-indigo-600' },
          { label: 'Finalizados',              value: stats.finished_deliverables,  color: 'text-emerald-600' },
          { label: 'Vencidos',                 value: stats.overdue_activities,     color: 'text-red-600' },
          { label: 'Salud del portafolio',     value: health ? `${health.portfolio_score}%` : 'N/A', color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="py-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Volume by role - horizontal bars */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Volumen por Etapa del Flujo</h3>
          </div>
          <div className="space-y-3">
            {[...roleDetail].sort((a, b) => b.total - a.total).map(r => {
              const pct = Math.round((r.approved / r.total) * 100);
              const approvedW = (r.approved / maxRole) * 100;
              const activeW   = (r.active / maxRole)   * 100;
              const overdueW  = (r.overdue / maxRole)  * 100;
              return (
                <div key={r.role}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}</span>
                    <span className="text-gray-500 dark:text-gray-500">{r.total} total · {pct}% completado</span>
                  </div>
                  <div className="flex h-4 rounded overflow-hidden gap-px">
                    <div className="bg-emerald-400" style={{ width: `${approvedW}%` }} title={`Aprobados: ${r.approved}`} />
                    <div className="bg-blue-400"    style={{ width: `${activeW}%` }}   title={`Activos: ${r.active}`} />
                    <div className="bg-red-400"     style={{ width: `${overdueW}%` }}  title={`Vencidos: ${r.overdue}`} />
                  </div>
                  <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5">
                    <span className="text-emerald-600">■ Aprobados {r.approved}</span>
                    <span className="text-blue-500">■ Activos {r.active}</span>
                    {r.overdue > 0 && <span className="text-red-500">■ Vencidos {r.overdue}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Status donut-ish */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Composición por Estado</h3>
          </div>
          {/* SVG donut */}
          <div className="flex items-center gap-6">
            <DonutChart data={Object.entries(byStatus).filter(([,v]) => v > 0).map(([k, v]) => ({ key: k, value: v, color: STATUS_INFO[k]?.color ?? '#9ca3af' }))} total={statusTotal} />
            <div className="flex-1 space-y-1.5">
              {Object.entries(byStatus).filter(([,v]) => v > 0).sort(([,a],[,b]) => b - a).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: STATUS_INFO[k]?.color ?? '#9ca3af' }} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{STATUS_INFO[k]?.label ?? k}</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{v}</span>
                  <span className="text-[10px] text-gray-400">{Math.round((v / statusTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Program ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-emerald-500" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Programas con mayor avance</h3>
          </div>
          {[...programs].sort((a, b) => b.compliance_percentage - a.compliance_percentage).slice(0, 6).map((p, i) => (
            <div key={p.id} onClick={() => router.push(`/entregables?filter=program_${p.id}`)}
              className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-1 py-1.5 -mx-1 transition-colors mb-1">
              <span className="text-xs text-gray-400 w-4 shrink-0 font-semibold">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${p.compliance_percentage}%` }} />
                </div>
              </div>
              <span className="text-sm font-bold text-emerald-600 shrink-0">{p.compliance_percentage}%</span>
            </div>
          ))}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <XCircle size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Programas con menor avance</h3>
          </div>
          {[...programs].sort((a, b) => a.compliance_percentage - b.compliance_percentage).slice(0, 6).map((p, i) => (
            <div key={p.id} onClick={() => router.push(`/entregables?filter=program_${p.id}`)}
              className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-1 py-1.5 -mx-1 transition-colors mb-1">
              <span className="text-xs text-gray-400 w-4 shrink-0 font-semibold">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div className={`h-1.5 rounded-full ${progressColor(p.compliance_percentage)}`} style={{ width: `${p.compliance_percentage || 3}%` }} />
                </div>
              </div>
              <span className={`text-sm font-bold shrink-0 ${p.compliance_percentage < 40 ? 'text-red-600' : 'text-amber-600'}`}>{p.compliance_percentage}%</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

function DonutChart({ data, total }: { data: { key: string; value: number; color: string }[]; total: number }) {
  const R = 40, CX = 50, CY = 50, strokeW = 14;
  const circ = 2 * Math.PI * R;
  let cumulative = 0;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e5e7eb" strokeWidth={strokeW} className="dark:stroke-gray-700" />
      {data.map(({ key, value, color }) => {
        const pct = value / total;
        const dash = pct * circ;
        const offset = circ - cumulative * circ;
        cumulative += pct;
        return (
          <circle key={key} cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={strokeW}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${CX} ${CY})`} />
        );
      })}
      <text x={CX} y={CY - 2} textAnchor="middle" className="text-base font-bold fill-gray-800 dark:fill-gray-100" fontSize="13" fontWeight="bold" fill="currentColor">{total}</text>
      <text x={CX} y={CY + 9} textAnchor="middle" fontSize="7" fill="#9ca3af">total</text>
    </svg>
  );
}

// ─── DashboardAdmin ───────────────────────────────────────────────────────────

function DashboardAdmin() {
  const [activeTab, setActiveTab] = useState<DashTab>('resumen');
  const [panelFilter, setPanelFilter] = useState<PanelFilter | null>(null);
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [health, setHealth]     = useState<HealthReport | null>(null);
  const [capacity, setCapacity] = useState<{ summary: CapacitySummary; users: CapacityUser[] } | null>(null);
  const [workload, setWorkload] = useState<WorkloadUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>(ENDPOINTS.DASHBOARD).catch(() => null),
      api.get<HealthReport>('/reports/health').catch(() => null),
      api.get<{ summary: CapacitySummary; users: CapacityUser[] }>('/capacity').catch(() => null),
      api.get<WorkloadUser[]>('/reports/workload').catch(() => []),
      api.get<Project[] | { data: Project[] }>('/projects?per_page=50').catch(() => []),
    ]).then(([s, h, c, w, p]) => {
      setStats(s);
      setHealth(h);
      setCapacity(c);
      setWorkload(Array.isArray(w) ? w : []);
      const projs = Array.isArray(p) ? p : (p as { data: Project[] })?.data ?? [];
      setProjects(projs);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6"><StatsSkeleton /></div>;
  if (!stats)  return (
    <div className="p-6">
      <div className="rounded-lg border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
        No fue posible cargar los indicadores del dashboard.
      </div>
    </div>
  );

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard Ejecutivo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Visión global de producción académica</p>
          </div>
          {/* Tab bar */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1 flex-wrap">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === id
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'resumen' && (
          <TabResumen stats={stats} health={health} capacity={capacity} workload={workload} onFilter={setPanelFilter} />
        )}
        {activeTab === 'seguimiento' && <TabSeguimiento projects={projects} />}
        {activeTab === 'capacidad'   && <TabCapacidad capacity={capacity} />}
        {activeTab === 'reportes'    && <TabReportes stats={stats} workload={workload} health={health} />}
      </div>

      <SlidingPanel filter={panelFilter} onClose={() => setPanelFilter(null)} />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoading } = useAuthContext();
  if (isLoading) return <div className="p-6"><StatsSkeleton /></div>;
  const isAdmin = user && ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number]);
  return isAdmin ? <DashboardAdmin /> : <DashboardOperativo />;
}
