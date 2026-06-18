'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderKanban, BookOpen, Activity, XCircle, CheckCircle2,
  TrendingUp, AlertTriangle, BarChart3, Users, Clock, Package,
  MessageSquare, X, CalendarDays, Gauge, LayoutDashboard,
  GitBranch, FileBarChart, ChevronRight, ChevronDown, Info,
} from 'lucide-react';
import DashboardOperativo from '@/components/DashboardOperativo';
import { StatsSkeleton } from '@/components/LoadingSkeleton';
import HealthBadge from '@/components/HealthBadge';
import CapacityBar from '@/components/CapacityBar';
import { api, ENDPOINTS } from '@/lib/api';
import type {
  DashboardStats, ProgramBreakdown, ActivityByRoleDetail,
  HealthReport, CapacitySummary, CapacityUser, Role, RoleActivity,
} from '@/lib/types';
import { ROLE_LABELS, ROLE_STATUS_LABELS } from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const ADMIN_ROLES = ['admin', 'coordinator'] as const;

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_INFO: Record<string, { label: string; color: string; tw: string; icon: string }> = {
  finished:          { label: 'Completado',      color: '#10b981', tw: 'bg-emerald-500', icon: '✓' },
  in_progress:       { label: 'En Ejecución',     color: '#3b82f6', tw: 'bg-blue-500',    icon: '▶' },
  in_review:         { label: 'En Revisión',      color: '#8b5cf6', tw: 'bg-purple-500',  icon: '⟳' },
  with_observations: { label: 'Con Observaciones',color: '#f59e0b', tw: 'bg-amber-400',   icon: '!' },
  pending_start:     { label: 'Pendiente',        color: '#9ca3af', tw: 'bg-gray-400',    icon: '○' },
  unpublished:       { label: 'Sin Publicar',     color: '#d1d5db', tw: 'bg-gray-300',    icon: '–' },
  cancelled:         { label: 'Cancelado',        color: '#fca5a5', tw: 'bg-red-300',     icon: '✕' },
  not_applicable:    { label: 'No Aplica',        color: '#cbd5e1', tw: 'bg-slate-300',   icon: '–' },
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
      <div className={`fixed right-0 top-0 h-full w-full sm:w-[480px] max-w-[100vw] bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col transition-transform duration-300 ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Detalle filtrado</p>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">{panelTitle}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-400 flex-shrink-0">
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
            const borderCls    = isOverdue ? 'border-l-4 border-l-red-500' : isApproach ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-blue-100 dark:border-l-blue-900';
            return (
              <div key={row.id} className={`bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${borderCls}`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">{row.name}</p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
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
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <p className="text-xs text-gray-400 text-center">{rows.length} registros encontrados</p>
        </div>
      </div>
    </>
  );
}

// ─── TAB: RESUMEN (sin tabla de Carga de trabajo, movida a Capacidad) ─────────

interface WorkloadUser {
  user_id: number; user_name: string; role: string;
  total: number; pending: number; in_review: number; overdue: number; completed: number;
}

function TabResumen({
  stats, health, capacity, onFilter,
}: {
  stats: DashboardStats;
  health: HealthReport | null;
  capacity: { summary: CapacitySummary; users: CapacityUser[] } | null;
  onFilter: (f: PanelFilter) => void;
}) {
  const router = useRouter();
  const d = stats;
  const globalPct = d.global_compliance_percentage ?? d.compliance_percentage ?? 0;
  const programs: ProgramBreakdown[] = d.programs_breakdown ?? [];
  const roleDetail: ActivityByRoleDetail[] = d.activities_by_role_detail ?? [];
  const byStatus = d.deliverables_by_status ?? {};
  const byProgress = [...programs].sort((a, b) => b.compliance_percentage - a.compliance_percentage);
  const statusTotal = Object.values(byStatus).reduce((s, v) => s + v, 0) || 1;

  const kpiCards = [
    { label: 'Proyectos Activos', value: d.active_projects,       icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', ring: 'hover:ring-indigo-300', filter: 'active_projects' as PanelFilter, highlight: false,
      tooltip: 'Iniciativa de producción con fecha de inicio y fin (ej. "Actualización Curricular 2026"). Es la unidad temporal del trabajo: vive, se ejecuta y se cierra.' },
    { label: 'Programas',         value: d.total_programs,        icon: BookOpen,     color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'hover:ring-emerald-300', filter: 'programs' as PanelFilter, highlight: false,
      tooltip: 'Producto académico permanente de la universidad (Especializaciones, Maestrías, Pregrados). No "termina": se mantiene y se actualiza. Un proyecto puede tocar varios programas a la vez.' },
    { label: 'Total Entregables', value: d.total_deliverables,    icon: Package,      color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', ring: 'hover:ring-amber-300', filter: 'total_deliverables' as PanelFilter, highlight: false,
      tooltip: 'Unidades de producción dentro de cada asignatura (semanas, módulos). Cada entregable pasa por los 6 roles del flujo: Experto → Pedagogía → Diseño → Audiovisual → Ingeniería → Calidad.' },
    { label: 'Vencidas',          value: d.overdue_activities,    icon: XCircle,      color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', ring: 'hover:ring-red-300', filter: 'overdue' as PanelFilter, highlight: (d.overdue_activities ?? 0) > 0,
      tooltip: 'Actividades cuya fecha de compromiso ya pasó sin haber sido completadas ni aprobadas por el siguiente rol del flujo.' },
    { label: 'Por Vencer',        value: d.approaching_activities,icon: AlertTriangle,color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', ring: 'hover:ring-orange-300', filter: 'approaching' as PanelFilter, highlight: false,
      tooltip: 'Actividades que vencen en los próximos 3 días. Útil para anticiparse antes de que entren al cuadro de Vencidas.' },
    { label: 'Con Observaciones', value: d.with_observations,     icon: MessageSquare,color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', ring: 'hover:ring-purple-300', filter: 'with_observations' as PanelFilter, highlight: false,
      tooltip: 'Entregables devueltos por Calidad o por un rol revisor con cambios solicitados. Requieren ajustes antes de continuar el flujo.' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, color, bg, ring, highlight, filter, tooltip }) => (
          <div key={label} className="relative group/kpi">
            <button onClick={() => onFilter(filter)}
              className={`w-full rounded-xl border p-4 flex flex-col gap-2 text-left transition-all cursor-pointer ring-2 ring-transparent ${ring} hover:shadow-md active:scale-95 ${highlight ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
              <div className={`${bg} rounded-lg p-2 self-start`}><Icon className={`${color} w-4 h-4`} /></div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
            </button>
            {/* Info icon + tooltip */}
            <div className="absolute top-2 right-2 pointer-events-none">
              <div className="pointer-events-auto group/info relative">
                <Info size={12} className="text-gray-300 dark:text-gray-600 group-hover/kpi:text-gray-400 dark:group-hover/kpi:text-gray-500 hover:!text-indigo-500 cursor-help transition-colors" />
                <div className="invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100 transition-opacity absolute right-0 top-5 w-64 bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-relaxed rounded-lg p-3 shadow-2xl z-50 pointer-events-none">
                  <p className="font-semibold mb-1 text-indigo-200">{label}</p>
                  <p className="text-gray-200">{tooltip}</p>
                  <div className="absolute -top-1 right-2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
                </div>
              </div>
            </div>
          </div>
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
                <span className="text-[10px] text-gray-400 ml-auto">Resumen rápido</span>
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
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
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
    </div>
  );
}

// ─── TAB: SEGUIMIENTO (Gantt jerárquico) ──────────────────────────────────────

interface GanttDeliverable {
  id: number; name: string; start_date?: string; commitment_date?: string;
  global_status: string;
  project_id?: number; project_name?: string;
  program_id?: number; program_name?: string;
  responsible_name?: string; responsible_role?: string;
  progress_pct?: number;
}

interface Project { id: number; name: string; }

const ROLE_COLORS: Record<string, string> = {
  expert: '#8b5cf6', pedagogy: '#3b82f6', design: '#ec4899',
  audiovisual: '#f59e0b', engineering: '#14b8a6', qa: '#10b981',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDeliv(item: any): GanttDeliverable {
  const acts = item.role_activities ?? item.activities ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = acts.find((a: any) => a.status !== 'approved' && a.status !== 'not_applicable') ?? acts[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completed = acts.filter((a: any) => a.status === 'approved').length;
  const total = acts.filter((a: { status: string }) => a.status !== 'not_applicable').length;
  return {
    id: item.id,
    name: item.name ?? '—',
    start_date: item.start_date,
    commitment_date: item.commitment_date ?? acts[acts.length - 1]?.commitment_date,
    global_status: item.global_status ?? 'pending_start',
    project_id: item.subject?.academic_program?.project?.id ?? item.project_id,
    project_name: item.subject?.academic_program?.project?.name ?? item.project_name ?? 'Sin proyecto',
    program_id: item.subject?.academic_program?.id ?? item.program_id,
    program_name: item.subject?.academic_program?.name ?? item.program_name ?? 'Sin programa',
    responsible_name: active?.responsible?.name ?? '—',
    responsible_role: active?.role,
    progress_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

type ZoomMode = 'week' | 'month' | 'quarter';

const ZOOM_CFG: Record<ZoomMode, { cellPx: number; cellsBack: number; cellsFwd: number; format: (d: Date) => string; addUnit: (d: Date, n: number) => Date; getStart: (d: Date) => Date }> = {
  week:    { cellPx: 110, cellsBack: 2, cellsFwd: 6,
             format: d => d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
             addUnit: (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n * 7); return r; },
             getStart: d => { const r = new Date(d); const day = r.getDay() || 7; r.setDate(r.getDate() - day + 1); r.setHours(0,0,0,0); return r; } },
  month:   { cellPx: 130, cellsBack: 1, cellsFwd: 5,
             format: d => d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }).toUpperCase(),
             addUnit: (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; },
             getStart: d => new Date(d.getFullYear(), d.getMonth(), 1) },
  quarter: { cellPx: 150, cellsBack: 1, cellsFwd: 3,
             format: d => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`,
             addUnit: (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n * 3); return r; },
             getStart: d => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1) },
};

/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */
function TabSeguimientoLegacy({ projects }: { projects: Project[] }) {
  const [selectedProject, setSelectedProject] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [colorMode, setColorMode] = useState<'status' | 'role'>('status');
  const [zoom, setZoom] = useState<ZoomMode>('week');
  const [deliverables, setDeliverables] = useState<GanttDeliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ d: GanttDeliverable; x: number; y: number } | null>(null);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cfg = ZOOM_CFG[zoom];
  const cellStart = cfg.getStart(today);
  const ganttStart = cfg.addUnit(cellStart, -cfg.cellsBack);
  const totalCells = cfg.cellsBack + cfg.cellsFwd + 1;
  const totalPx = totalCells * cfg.cellPx;

  const unitMs = zoom === 'week' ? 7 * 86400000 : zoom === 'month' ? 30.44 * 86400000 : 91.31 * 86400000;
  const dateToX = (d: Date) => ((d.getTime() - ganttStart.getTime()) / unitMs) * cfg.cellPx;
  const todayX = dateToX(today);
  const cellLabels = Array.from({ length: totalCells }, (_, i) => cfg.addUnit(ganttStart, i));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '100' };
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

  // Hierarchical structure: projects → programs → deliverables
  const tree = useMemo(() => {
    const map = new Map<string, { name: string; programs: Map<string, { name: string; items: GanttDeliverable[] }> }>();
    deliverables.forEach(d => {
      const pkey = String(d.project_id ?? d.project_name);
      if (!map.has(pkey)) map.set(pkey, { name: d.project_name ?? '—', programs: new Map() });
      const prog = map.get(pkey)!;
      const gkey = String(d.program_id ?? d.program_name);
      if (!prog.programs.has(gkey)) prog.programs.set(gkey, { name: d.program_name ?? '—', items: [] });
      prog.programs.get(gkey)!.items.push(d);
    });
    return map;
  }, [deliverables]);

  // Auto-expand: initially expand all projects on first load
  useEffect(() => {
    if (tree.size > 0 && expandedProjects.size === 0) {
      setExpandedProjects(new Set(tree.keys()));
    }
  }, [tree, expandedProjects.size]);

  function getDateRange(items: GanttDeliverable[]): { start: Date | null; end: Date | null; pct: number } {
    if (items.length === 0) return { start: null, end: null, pct: 0 };
    let minStart: number | null = null, maxEnd: number | null = null, pctSum = 0, pctCount = 0;
    items.forEach(it => {
      const s = it.start_date ? new Date(it.start_date + 'T00:00:00').getTime() : null;
      const e = it.commitment_date ? new Date(it.commitment_date + 'T00:00:00').getTime() : null;
      if (s !== null) minStart = minStart === null ? s : Math.min(minStart, s);
      if (e !== null) maxEnd   = maxEnd   === null ? e : Math.max(maxEnd, e);
      pctSum += it.progress_pct ?? 0;
      pctCount++;
    });
    return {
      start: minStart !== null ? new Date(minStart) : null,
      end:   maxEnd   !== null ? new Date(maxEnd)   : null,
      pct: pctCount > 0 ? Math.round(pctSum / pctCount) : 0,
    };
  }

  function renderBar(start: Date | null, end: Date | null, color: string, pct: number, height = 18, opacity = 0.8) {
    if (!start || !end) return null;
    const rawLeft = dateToX(start);
    const rawRight = dateToX(end);
    const barLeft  = Math.max(0, Math.min(rawLeft, totalPx - 4));
    const barWidth = Math.max(6, Math.min(rawRight, totalPx) - barLeft);
    return (
      <>
        <div className="absolute rounded-md" style={{
          left: `${barLeft}px`, width: `${barWidth}px`, height: `${height}px`,
          top: `calc(50% - ${height / 2}px)`,
          background: color, opacity,
        }}>
          {/* Progress fill */}
          {pct > 0 && (
            <div className="absolute top-0 left-0 h-full rounded-md" style={{
              width: `${pct}%`, background: 'rgba(255,255,255,0.35)',
            }} />
          )}
        </div>
      </>
    );
  }

  function colorFor(d: GanttDeliverable): string {
    if (colorMode === 'role' && d.responsible_role && ROLE_COLORS[d.responsible_role]) return ROLE_COLORS[d.responsible_role];
    return STATUS_INFO[d.global_status]?.color ?? '#9ca3af';
  }

  function toggleProject(k: string) {
    setExpandedProjects(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }
  function toggleProgram(k: string) {
    setExpandedPrograms(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }

  function expandAll()   { setExpandedProjects(new Set(tree.keys())); const pk = new Set<string>(); tree.forEach((proj) => proj.programs.forEach((_, k) => pk.add(k))); setExpandedPrograms(pk); }
  function collapseAll() { setExpandedProjects(new Set()); setExpandedPrograms(new Set()); }

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

          {/* Zoom */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-0.5">
            {(['week', 'month', 'quarter'] as ZoomMode[]).map(z => (
              <button key={z} onClick={() => setZoom(z)}
                className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${zoom === z ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'}`}>
                {z === 'week' ? 'Semana' : z === 'month' ? 'Mes' : 'Trimestre'}
              </button>
            ))}
          </div>

          {/* Color mode */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-0.5">
            <button onClick={() => setColorMode('status')}
              className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${colorMode === 'status' ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>
              Color por estado
            </button>
            <button onClick={() => setColorMode('role')}
              className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${colorMode === 'role' ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>
              Color por rol
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Expandir todo</button>
            <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Colapsar todo</button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 flex-wrap text-xs text-gray-500 dark:text-gray-400">
          {colorMode === 'status'
            ? Object.entries(STATUS_INFO).slice(0, 7).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: v.color }} />
                  {v.label}
                </span>
              ))
            : Object.entries(ROLE_COLORS).map(([k, color]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
                  {ROLE_LABELS[k as keyof typeof ROLE_LABELS] ?? k}
                </span>
              ))
          }
        </div>
      </Card>

      {/* Gantt */}
      <Card className="p-0 overflow-hidden relative">
        <div className="overflow-auto max-h-[600px]" onMouseLeave={() => setTooltip(null)}>
          <div style={{ minWidth: `${260 + totalPx}px` }}>
            {/* Header */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 sticky top-0 z-20">
              <div className="w-64 shrink-0 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-900 z-30">
                Estructura
              </div>
              <div className="flex relative" style={{ width: `${totalPx}px` }}>
                {cellLabels.map((d, i) => {
                  const isCurrent = i === cfg.cellsBack;
                  return (
                    <div key={i} className={`flex-shrink-0 text-center py-3 border-r border-gray-200 dark:border-gray-700 ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`} style={{ width: `${cfg.cellPx}px` }}>
                      <p className={`text-[10px] font-semibold ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-500'}`}>
                        {cfg.format(d)}
                      </p>
                      <p className={`text-[10px] ${isCurrent ? 'text-indigo-500 dark:text-indigo-400 font-semibold' : 'text-gray-400'}`}>
                        {isCurrent ? 'ACTUAL' : `${zoom === 'week' ? 'Sem' : zoom === 'month' ? 'Mes' : 'Trim'} ${i + 1}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows */}
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Cargando datos...</div>
            ) : tree.size === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400 dark:text-gray-500">Sin entregables para los filtros seleccionados.</div>
            ) : Array.from(tree.entries()).map(([projKey, projData]) => {
              const projOpen = expandedProjects.has(projKey);
              const allItems = Array.from(projData.programs.values()).flatMap(p => p.items);
              const projRange = getDateRange(allItems);
              const projColor = '#4f46e5'; // indigo for project level
              const overdueCount = allItems.filter(i => i.global_status !== 'finished' && i.commitment_date && new Date(i.commitment_date + 'T00:00:00') < today).length;

              return (
                <div key={projKey}>
                  {/* PROJECT ROW */}
                  <div className="flex border-b-2 border-gray-200 dark:border-gray-700 bg-indigo-50/50 dark:bg-indigo-900/10 group">
                    <button onClick={() => toggleProject(projKey)}
                      className="w-64 shrink-0 px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-indigo-50/50 dark:bg-indigo-900/10 z-10 flex items-center gap-1.5 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/20 text-left">
                      {projOpen ? <ChevronDown size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" /> : <ChevronRight size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                      <FolderKanban size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="text-xs font-bold text-indigo-900 dark:text-indigo-100 truncate flex-1">{projData.name}</span>
                      <span className="text-[10px] text-indigo-500 shrink-0">{allItems.length}</span>
                      {overdueCount > 0 && <span className="text-[9px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 shrink-0">{overdueCount}</span>}
                    </button>
                    <div className="relative flex items-center" style={{ width: `${totalPx}px`, height: '42px' }}>
                      {cellLabels.map((_, i) => (
                        <div key={i} className={`absolute top-0 bottom-0 border-r border-gray-200/60 dark:border-gray-700/40 ${i === cfg.cellsBack ? 'bg-indigo-100/30 dark:bg-indigo-900/10' : ''}`}
                          style={{ left: `${i * cfg.cellPx}px`, width: `${cfg.cellPx}px` }} />
                      ))}
                      {todayX >= 0 && todayX <= totalPx && <div className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none" style={{ left: `${todayX}px` }} />}
                      {renderBar(projRange.start, projRange.end, projColor, projRange.pct, 14, 0.5)}
                      {projRange.pct > 0 && projRange.start && projRange.end && (
                        <span className="absolute text-[9px] font-bold text-indigo-900 dark:text-indigo-200 pointer-events-none"
                          style={{ left: `${Math.min(dateToX(projRange.start) + 8, totalPx - 30)}px`, top: '50%', transform: 'translateY(-50%)' }}>
                          {projRange.pct}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PROGRAM ROWS */}
                  {projOpen && Array.from(projData.programs.entries()).map(([gKey, gData]) => {
                    const progOpen = expandedPrograms.has(projKey + '|' + gKey);
                    const gRange = getDateRange(gData.items);
                    const gColor = '#0ea5e9';
                    return (
                      <div key={gKey}>
                        {/* PROGRAM ROW */}
                        <div className="flex border-b border-gray-100 dark:border-gray-700 bg-sky-50/40 dark:bg-sky-900/10">
                          <button onClick={() => toggleProgram(projKey + '|' + gKey)}
                            className="w-64 shrink-0 pl-8 pr-3 py-2 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-sky-50/40 dark:bg-sky-900/10 z-10 flex items-center gap-1.5 hover:bg-sky-100/60 dark:hover:bg-sky-900/20 text-left">
                            {progOpen ? <ChevronDown size={12} className="text-sky-600 dark:text-sky-400 shrink-0" /> : <ChevronRight size={12} className="text-sky-600 dark:text-sky-400 shrink-0" />}
                            <BookOpen size={12} className="text-sky-600 dark:text-sky-400 shrink-0" />
                            <span className="text-[11px] font-semibold text-sky-900 dark:text-sky-100 truncate flex-1">{gData.name}</span>
                            <span className="text-[10px] text-sky-500 shrink-0">{gData.items.length}</span>
                          </button>
                          <div className="relative flex items-center" style={{ width: `${totalPx}px`, height: '34px' }}>
                            {cellLabels.map((_, i) => (
                              <div key={i} className={`absolute top-0 bottom-0 border-r border-gray-100 dark:border-gray-700/40 ${i === cfg.cellsBack ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`}
                                style={{ left: `${i * cfg.cellPx}px`, width: `${cfg.cellPx}px` }} />
                            ))}
                            {todayX >= 0 && todayX <= totalPx && <div className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none" style={{ left: `${todayX}px` }} />}
                            {renderBar(gRange.start, gRange.end, gColor, gRange.pct, 12, 0.6)}
                          </div>
                        </div>

                        {/* DELIVERABLE ROWS */}
                        {progOpen && gData.items.map(deliv => {
                          const startDate = deliv.start_date ? new Date(deliv.start_date + 'T00:00:00') : null;
                          const endDate = deliv.commitment_date ? new Date(deliv.commitment_date + 'T00:00:00') : null;
                          const isOverdue = endDate && endDate < today && deliv.global_status !== 'finished';
                          const color = colorFor(deliv);
                          return (
                            <div key={deliv.id} className="flex border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
                              onMouseEnter={(e) => setTooltip({ d: deliv, x: e.clientX, y: e.clientY })}
                              onMouseMove={(e) => setTooltip({ d: deliv, x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              <div className="w-64 shrink-0 pl-12 pr-3 py-2 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/30 z-10 flex items-center gap-1.5">
                                {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Vencida" />}
                                <span className="text-[11px] text-gray-800 dark:text-gray-200 truncate flex-1">{deliv.name}</span>
                                <span className="text-[10px] text-gray-400 shrink-0">{STATUS_INFO[deliv.global_status]?.icon}</span>
                              </div>
                              <div className="relative flex items-center" style={{ width: `${totalPx}px`, height: '32px' }}>
                                {cellLabels.map((_, i) => (
                                  <div key={i} className={`absolute top-0 bottom-0 border-r border-gray-100 dark:border-gray-700/30 ${i === cfg.cellsBack ? 'bg-indigo-50/10 dark:bg-indigo-900/5' : ''}`}
                                    style={{ left: `${i * cfg.cellPx}px`, width: `${cfg.cellPx}px` }} />
                                ))}
                                {todayX >= 0 && todayX <= totalPx && <div className="absolute top-0 bottom-0 w-px bg-red-500/70 z-10 pointer-events-none" style={{ left: `${todayX}px` }} />}
                                {renderBar(startDate, endDate, color, deliv.progress_pct ?? 0, 18, 0.85)}
                                {!startDate && !endDate && <span className="absolute left-2 text-[10px] text-gray-400 italic">Sin fechas asignadas</span>}
                                {isOverdue && (
                                  <span className="absolute right-1 top-1 text-[8px] font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-1 rounded">!</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-400 flex items-center justify-between flex-wrap gap-2">
          <span>{deliverables.length} entregables · {tree.size} proyecto(s)</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Hoy</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-indigo-500 inline-block" /> Proyecto</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-sky-500 inline-block" /> Fase</span>
          </span>
        </div>
      </Card>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed pointer-events-none z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-3 max-w-xs"
          style={{ left: Math.min(tooltip.x + 12, window.innerWidth - 280), top: Math.min(tooltip.y + 12, window.innerHeight - 200) }}>
          <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-1.5 leading-tight">{tooltip.d.name}</p>
          <div className="space-y-1 text-[11px]">
            <div className="flex gap-2"><span className="text-gray-400 w-16">Proyecto:</span><span className="text-gray-700 dark:text-gray-300 flex-1 truncate">{tooltip.d.project_name}</span></div>
            <div className="flex gap-2"><span className="text-gray-400 w-16">Fase:</span><span className="text-gray-700 dark:text-gray-300 flex-1 truncate">{tooltip.d.program_name}</span></div>
            <div className="flex gap-2"><span className="text-gray-400 w-16">Responsable:</span><span className="text-gray-700 dark:text-gray-300">{tooltip.d.responsible_name}</span></div>
            <div className="flex gap-2"><span className="text-gray-400 w-16">Inicio:</span><span className="text-gray-700 dark:text-gray-300">{tooltip.d.start_date ? formatDateStr(tooltip.d.start_date) : '—'}</span></div>
            <div className="flex gap-2"><span className="text-gray-400 w-16">Fin:</span><span className="text-gray-700 dark:text-gray-300">{tooltip.d.commitment_date ? formatDateStr(tooltip.d.commitment_date) : '—'}</span></div>
            <div className="flex gap-2"><span className="text-gray-400 w-16">Estado:</span>
              <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_INFO[tooltip.d.global_status]?.color }} />
                {STATUS_INFO[tooltip.d.global_status]?.label ?? tooltip.d.global_status}
              </span>
            </div>
            <div className="flex gap-2"><span className="text-gray-400 w-16">Avance:</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 bg-indigo-500 rounded-full" style={{ width: `${tooltip.d.progress_pct ?? 0}%` }} />
                </div>
                <span className="text-gray-700 dark:text-gray-300 font-semibold">{tooltip.d.progress_pct ?? 0}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* eslint-enable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */

type GanttColor = { base: string; light: string; border: string; text: string };

const PROGRAM_PALETTE: GanttColor[] = [
  { base: '#14b8a6', light: '#99f6e4', border: '#5eead4', text: '#0f766e' },
  { base: '#ec4899', light: '#fbcfe8', border: '#f9a8d4', text: '#be185d' },
  { base: '#22c55e', light: '#bbf7d0', border: '#86efac', text: '#15803d' },
  { base: '#3b82f6', light: '#bfdbfe', border: '#93c5fd', text: '#1d4ed8' },
  { base: '#f59e0b', light: '#fde68a', border: '#fcd34d', text: '#b45309' },
  { base: '#8b5cf6', light: '#ddd6fe', border: '#c4b5fd', text: '#6d28d9' },
  { base: '#dc2626', light: '#fecaca', border: '#fca5a5', text: '#b91c1c' },
];

interface GanttActivityRow {
  id: string;
  deliverableId: number;
  name: string;
  phaseName: string;
  programKey: string;
  programName: string;
  projectName: string;
  role: Role;
  responsible: string;
  status: string;
  start: Date | null;
  end: Date | null;
  progress: number;
  overdue: boolean;
}

interface GanttPhaseRow {
  key: string;
  name: string;
  projectName: string;
  programName: string;
  activities: GanttActivityRow[];
  start: Date | null;
  end: Date | null;
  progress: number;
  overdue: boolean;
}

interface GanttProgramRow {
  key: string;
  name: string;
  projectName: string;
  color: GanttColor;
  phases: GanttPhaseRow[];
  start: Date | null;
  end: Date | null;
  progress: number;
  overdueCount: number;
}

interface RawGanttDeliverable {
  id: number;
  name?: string;
  start_date?: string | null;
  commitment_date?: string | null;
  global_status?: string;
  program_id?: number | string | null;
  program_name?: string | null;
  project_name?: string | null;
  role_activities?: RoleActivity[];
  activities?: RoleActivity[];
  subject?: {
    academic_program?: {
      id?: number | string;
      name?: string | null;
      project?: { name?: string | null };
    } | null;
  } | null;
}

type GanttTooltip =
  | { type: 'program'; item: GanttProgramRow; x: number; y: number }
  | { type: 'phase'; item: GanttPhaseRow; color: GanttColor; x: number; y: number }
  | { type: 'activity'; item: GanttActivityRow; color: GanttColor; x: number; y: number };

function parseLocalDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function progressFromRoleStatus(status: string) {
  const map: Record<string, number> = {
    approved: 100,
    delivered: 90,
    in_review: 80,
    validating: 75,
    adjustments_requested: 65,
    adjusting: 60,
    production: 55,
    editing: 55,
    implementing: 50,
    in_testing: 50,
    in_development: 45,
    designing: 40,
    draft: 20,
    pending: 10,
    not_started: 0,
    not_applicable: 100,
  };
  return map[status] ?? 0;
}

function aggregateRange<T extends { start: Date | null; end: Date | null; progress: number }>(items: T[]) {
  const starts = items.map(i => i.start?.getTime()).filter((n): n is number => typeof n === 'number');
  const ends = items.map(i => i.end?.getTime()).filter((n): n is number => typeof n === 'number');
  const weighted = items.reduce((acc, item) => {
    const weight = daysBetween(item.start, item.end) || 1;
    return { total: acc.total + item.progress * weight, weight: acc.weight + weight };
  }, { total: 0, weight: 0 });
  return {
    start: starts.length ? new Date(Math.min(...starts)) : null,
    end: ends.length ? new Date(Math.max(...ends)) : null,
    progress: weighted.weight ? clampPct(weighted.total / weighted.weight) : 0,
  };
}

function programColorFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PROGRAM_PALETTE[hash % PROGRAM_PALETTE.length];
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function formatShortDate(date: Date | null) {
  return date ? date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
}

function GanttBar({
  start, end, progress, color, dateToX, totalPx, height = 18, muted = false,
}: {
  start: Date | null; end: Date | null; progress: number; color: GanttColor;
  dateToX: (date: Date) => number; totalPx: number; height?: number; muted?: boolean;
}) {
  if (!start || !end) return <span className="absolute left-3 text-[10px] text-gray-400 italic">Sin fechas</span>;
  const rawLeft = dateToX(start);
  const rawRight = dateToX(addDays(end, 1));
  const left = Math.max(0, Math.min(rawLeft, totalPx - 8));
  const width = Math.max(12, Math.min(rawRight, totalPx) - left);
  return (
    <div
      className="absolute overflow-hidden rounded-full shadow-sm"
      style={{
        left,
        width,
        height,
        top: `calc(50% - ${height / 2}px)`,
        backgroundColor: color.light,
        border: `1px solid ${color.border}`,
        opacity: muted ? 0.72 : 1,
      }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clampPct(progress)}%`, backgroundColor: color.base }}
      />
    </div>
  );
}

function GanttTooltipCard({ tooltip }: { tooltip: GanttTooltip }) {
  const item = tooltip.item;
  const color = tooltip.type === 'program' ? tooltip.item.color : tooltip.color;
  const isActivity = tooltip.type === 'activity';
  const subtitle = tooltip.type === 'activity' ? tooltip.item.programName : tooltip.item.projectName;
  const responsible = isActivity ? tooltip.item.responsible : tooltip.type === 'phase' ? `${tooltip.item.activities.length} actividad(es)` : `${tooltip.item.phases.length} fase(s)`;
  const status = isActivity ? ROLE_STATUS_LABELS[tooltip.item.status] ?? tooltip.item.status : tooltip.type === 'phase' && tooltip.item.overdue ? 'Con retrasos' : tooltip.type === 'program' && tooltip.item.overdueCount > 0 ? 'Con retrasos' : 'En seguimiento';
  return (
    <div
      className="fixed pointer-events-none z-50 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      style={{ left: Math.min(tooltip.x + 14, window.innerWidth - 300), top: Math.min(tooltip.y + 14, window.innerHeight - 230) }}
    >
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: color.base }} />
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-gray-900 dark:text-gray-100">{item.name}</p>
          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-300">
        <div className="flex justify-between gap-3"><span className="text-gray-400">Responsable</span><span className="truncate font-medium">{responsible}</span></div>
        <div className="flex justify-between gap-3"><span className="text-gray-400">Inicio</span><span>{formatShortDate(item.start)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-gray-400">Fin</span><span>{formatShortDate(item.end)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-gray-400">Duración</span><span>{daysBetween(item.start, item.end)} día(s)</span></div>
        <div className="flex justify-between gap-3"><span className="text-gray-400">Estado</span><span className="font-medium">{status}</span></div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px]">
          <span className="text-gray-400">Avance</span>
          <span className="font-bold" style={{ color: color.text }}>{item.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: color.light }}>
          <div className="h-full rounded-full" style={{ width: `${item.progress}%`, backgroundColor: color.base }} />
        </div>
      </div>
    </div>
  );
}

function TabSeguimiento({ projects }: { projects: Project[] }) {
  const [selectedProject, setSelectedProject] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [deliverables, setDeliverables] = useState<RawGanttDeliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<GanttTooltip | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '200' };
      if (selectedProject) params.project_id = String(selectedProject);
      if (selectedStatus) params.status = selectedStatus;
      const raw = await api.get<RawGanttDeliverable[] | { data?: RawGanttDeliverable[] }>(ENDPOINTS.DELIVERABLES + '?' + new URLSearchParams(params).toString());
      setDeliverables(Array.isArray(raw) ? raw : raw?.data ?? []);
    } catch {
      setDeliverables([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedStatus]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  const programs = useMemo<GanttProgramRow[]>(() => {
    const programMap = new Map<string, { name: string; projectName: string; phases: Map<string, GanttPhaseRow> }>();

    deliverables.forEach((item) => {
      const programId = item.subject?.academic_program?.id ?? item.program_id ?? item.program_name ?? 'sin-programa';
      const programKey = String(programId);
      const programName = item.subject?.academic_program?.name ?? item.program_name ?? 'Sin programa';
      const projectName = item.subject?.academic_program?.project?.name ?? item.project_name ?? 'Sin proyecto';
      const phaseKey = `${programKey}|${item.id}`;
      const phaseName = item.name ?? 'Sin nombre';
      const activities: RoleActivity[] = item.role_activities ?? item.activities ?? [];

      if (!programMap.has(programKey)) {
        programMap.set(programKey, { name: programName, projectName, phases: new Map() });
      }

      const rows = activities.length > 0 ? activities : [{
        id: item.id,
        role: 'expert' as Role,
        responsible: undefined,
        commitment_date: item.commitment_date,
        actual_start_date: item.start_date,
        actual_delivery_date: undefined,
        status: item.global_status === 'finished' ? 'approved' : item.global_status === 'in_progress' ? 'in_development' : 'not_started',
      } as RoleActivity];

      const activityRows = rows
        .filter((act) => act.status !== 'not_applicable')
        .map((act) => {
          const start = parseLocalDate(act.actual_start_date) ?? parseLocalDate(item.start_date) ?? parseLocalDate(act.commitment_date);
          const end = parseLocalDate(act.actual_delivery_date) ?? parseLocalDate(act.commitment_date) ?? start;
          const overdue = !!end && end < today && !['approved', 'not_applicable'].includes(act.status);
          return {
            id: `${item.id}-${act.id}-${act.role}`,
            deliverableId: item.id,
            name: ROLE_LABELS[act.role] ?? act.role,
            phaseName,
            programKey,
            programName,
            projectName,
            role: act.role,
            responsible: act.responsible?.name ?? 'Sin asignar',
            status: act.status,
            start,
            end,
            progress: progressFromRoleStatus(act.status),
            overdue,
          };
        });

      const phaseRange = aggregateRange(activityRows);
      const phase: GanttPhaseRow = {
        key: phaseKey,
        name: phaseName,
        projectName,
        programName,
        activities: activityRows,
        start: phaseRange.start,
        end: phaseRange.end,
        progress: phaseRange.progress,
        overdue: activityRows.some(a => a.overdue),
      };

      programMap.get(programKey)!.phases.set(phaseKey, phase);
    });

    return Array.from(programMap.entries()).map(([key, value]) => {
      const phases = Array.from(value.phases.values()).sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
      const range = aggregateRange(phases);
      return {
        key,
        name: value.name,
        projectName: value.projectName,
        color: programColorFor(key + value.name),
        phases,
        start: range.start,
        end: range.end,
        progress: range.progress,
        overdueCount: phases.reduce((sum, phase) => sum + phase.activities.filter(a => a.overdue).length, 0),
      };
    })
      .filter(program => !onlyOverdue || program.overdueCount > 0)
      .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
  }, [deliverables, onlyOverdue, today]);

  const timeline = useMemo(() => {
    const dates = programs.flatMap(p => [p.start, p.end, ...p.phases.flatMap(ph => [ph.start, ph.end])]).filter((d): d is Date => !!d);
    const min = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : today;
    const max = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : addDays(today, 56);
    const start = startOfWeek(addDays(min, -14));
    const end = startOfWeek(addDays(max, 21));
    const weeks = Math.max(8, Math.ceil((end.getTime() - start.getTime()) / (7 * 86400000)) + 1);
    const cellPx = 104;
    const weekStarts = Array.from({ length: weeks }, (_, i) => addDays(start, i * 7));
    const monthSpans: Array<{ label: string; left: number; width: number }> = [];
    weekStarts.forEach((week, i) => {
      const key = dateKey(week);
      const existing = monthSpans[monthSpans.length - 1];
      if (existing && existing.label === key) existing.width += cellPx;
      else monthSpans.push({
        label: week.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
        left: i * cellPx,
        width: cellPx,
      });
    });
    const totalPx = weeks * cellPx;
    const dateToX = (date: Date) => ((date.getTime() - start.getTime()) / (7 * 86400000)) * cellPx;
    return { start, weeks, cellPx, weekStarts, monthSpans, totalPx, dateToX, todayX: dateToX(today) };
  }, [programs, today]);

  const toggleProgram = (key: string) => setExpandedPrograms(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const togglePhase = (key: string) => setExpandedPhases(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const expandAll = () => {
    setExpandedPrograms(new Set(programs.map(p => p.key)));
    setExpandedPhases(new Set(programs.flatMap(p => p.phases.map(ph => ph.key))));
  };
  const collapseAll = () => {
    setExpandedPrograms(new Set());
    setExpandedPhases(new Set());
  };

  const gridLines = (
    <>
      {timeline.weekStarts.map((_, i) => (
        <div key={i} className="absolute top-0 bottom-0 border-r border-gray-100 dark:border-gray-700/50" style={{ left: i * timeline.cellPx, width: timeline.cellPx }} />
      ))}
      {timeline.todayX >= 0 && timeline.todayX <= timeline.totalPx && (
        <div className="absolute top-0 bottom-0 z-20 border-l-2 border-dotted border-gray-900 dark:border-gray-100" style={{ left: timeline.todayX }}>
          <span className="absolute -top-5 -translate-x-1/2 rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-bold text-white dark:bg-gray-100 dark:text-gray-900">Hoy</span>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <Card className="py-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value === '' ? '' : Number(e.target.value))}
            className="min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 sm:w-auto">
            <option value="">Todos los proyectos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
            className="min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 sm:w-auto">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={() => setOnlyOverdue(v => !v)}
            className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${onlyOverdue ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}`}>
            Solo retrasos
          </button>
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <button onClick={expandAll} className="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 sm:flex-none">Expandir todo</button>
            <button onClick={collapseAll} className="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 sm:flex-none">Colapsar todo</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          {PROGRAM_PALETTE.slice(0, 6).map((color, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-full" style={{ background: `linear-gradient(90deg, ${color.base} 55%, ${color.light} 55%)` }} />
              Programa {i + 1}
            </span>
          ))}
        </div>
      </Card>

      <Card className="relative overflow-hidden p-0">
        <div className="max-h-[640px] overflow-auto" onMouseLeave={() => setTooltip(null)}>
          <div style={{ minWidth: 340 + timeline.totalPx }}>
            <div className="sticky top-0 z-30 flex border-b border-gray-200 bg-gray-50 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="sticky left-0 z-40 w-[340px] shrink-0 border-r border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900">
                Programa / fase / actividad
              </div>
              <div className="relative" style={{ width: timeline.totalPx }}>
                <div className="flex h-7 border-b border-gray-200 dark:border-gray-700">
                  {timeline.monthSpans.map((m, i) => (
                    <div key={`${m.label}-${i}`} className="absolute top-0 h-7 border-r border-gray-200 px-2 text-center text-[10px] font-bold uppercase text-gray-600 dark:border-gray-700 dark:text-gray-300" style={{ left: m.left, width: m.width }}>
                      {m.label}
                    </div>
                  ))}
                </div>
                <div className="flex h-8">
                  {timeline.weekStarts.map((week, i) => (
                    <div key={i} className="shrink-0 border-r border-gray-200 px-1 py-1 text-center text-[10px] text-gray-500 dark:border-gray-700" style={{ width: timeline.cellPx }}>
                      <span className="font-semibold">Sem {i + 1}</span>
                      <span className="block">{week.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-gray-400">Cargando Gantt...</div>
            ) : programs.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">Sin actividades para los filtros seleccionados.</div>
            ) : (
              <div>
                {programs.map(program => {
                  const programOpen = expandedPrograms.has(program.key);
                  return (
                    <div key={program.key}>
                      <div
                        className="flex border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                        onMouseEnter={(e) => setTooltip({ type: 'program', item: program, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setTooltip({ type: 'program', item: program, x: e.clientX, y: e.clientY })}
                      >
                        <button onClick={() => toggleProgram(program.key)}
                          className="sticky left-0 z-20 flex h-12 w-[340px] shrink-0 items-center gap-2 border-r border-gray-200 bg-white px-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
                          {programOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: program.color.base }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900 dark:text-gray-100" title={program.name}>{program.name}</span>
                          <span className="text-[10px] font-semibold" style={{ color: program.color.text }}>{program.progress}%</span>
                          {program.overdueCount > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{program.overdueCount}</span>}
                        </button>
                        <div className="relative h-12" style={{ width: timeline.totalPx }}>
                          {gridLines}
                          <GanttBar start={program.start} end={program.end} progress={program.progress} color={program.color} dateToX={timeline.dateToX} totalPx={timeline.totalPx} height={20} />
                        </div>
                      </div>

                      {programOpen && program.phases.map(phase => {
                        const phaseOpen = expandedPhases.has(phase.key);
                        return (
                          <div key={phase.key}>
                            <div
                              className="flex border-b border-gray-100 bg-gray-50/60 dark:border-gray-700/70 dark:bg-gray-800/80"
                              onMouseEnter={(e) => setTooltip({ type: 'phase', item: phase, color: program.color, x: e.clientX, y: e.clientY })}
                              onMouseMove={(e) => setTooltip({ type: 'phase', item: phase, color: program.color, x: e.clientX, y: e.clientY })}
                            >
                              <button onClick={() => togglePhase(phase.key)}
                                className="sticky left-0 z-20 flex h-10 w-[340px] shrink-0 items-center gap-2 border-r border-gray-200 bg-gray-50/95 pl-8 pr-3 text-left hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
                                {phaseOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-800 dark:text-gray-200" title={phase.name}>{phase.name}</span>
                                {phase.overdue && <span className="h-2 w-2 rounded-full bg-red-500" title="Tiene retrasos" />}
                                <span className="text-[10px] text-gray-400">{phase.progress}%</span>
                              </button>
                              <div className="relative h-10" style={{ width: timeline.totalPx }}>
                                {gridLines}
                                <GanttBar start={phase.start} end={phase.end} progress={phase.progress} color={program.color} dateToX={timeline.dateToX} totalPx={timeline.totalPx} height={16} muted />
                              </div>
                            </div>

                            {phaseOpen && phase.activities.map(activity => (
                              <div
                                key={activity.id}
                                className="flex border-b border-gray-50 bg-white hover:bg-gray-50 dark:border-gray-700/50 dark:bg-gray-800 dark:hover:bg-gray-700/50"
                                onMouseEnter={(e) => setTooltip({ type: 'activity', item: activity, color: program.color, x: e.clientX, y: e.clientY })}
                                onMouseMove={(e) => setTooltip({ type: 'activity', item: activity, color: program.color, x: e.clientX, y: e.clientY })}
                              >
                                <div className="sticky left-0 z-20 flex h-9 w-[340px] shrink-0 items-center gap-2 border-r border-gray-200 bg-white pl-14 pr-3 dark:border-gray-700 dark:bg-gray-800">
                                  {activity.overdue && <span className="h-2 w-2 rounded-full bg-red-500" />}
                                  <span className="w-20 shrink-0 truncate text-[11px] font-semibold text-gray-700 dark:text-gray-200">{activity.name}</span>
                                  <span className="min-w-0 flex-1 truncate text-[11px] text-gray-500">{activity.responsible}</span>
                                  <span className="text-[10px] text-gray-400">{activity.progress}%</span>
                                </div>
                                <div className="relative h-9" style={{ width: timeline.totalPx }}>
                                  {gridLines}
                                  <GanttBar start={activity.start} end={activity.end} progress={activity.progress} color={program.color} dateToX={timeline.dateToX} totalPx={timeline.totalPx} height={18} />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-400 dark:border-gray-700 dark:bg-gray-900">
          <span>{programs.length} programa(s) · {programs.reduce((sum, p) => sum + p.phases.length, 0)} fase(s)</span>
          <span>Color sólido = avance completado · color claro = pendiente · línea punteada = hoy</span>
        </div>
      </Card>

      {tooltip && <GanttTooltipCard tooltip={tooltip} />}
    </div>
  );
}

// ─── TAB: CAPACIDAD (Consolidada: utilización + distribución por user/rol/proy) ─

interface CapacityProjectAgg {
  project: string;
  total: number;
  pending: number;
  overdue: number;
  completed: number;
}

function TabCapacidad({
  capacity, workload, programs,
}: {
  capacity: { summary: CapacitySummary; users: CapacityUser[] } | null;
  workload: WorkloadUser[];
  programs: ProgramBreakdown[];
}) {
  const router = useRouter();
  const [groupBy, setGroupBy] = useState<'user' | 'role' | 'project'>('user');

  if (!capacity) return (
    <Card><p className="text-sm text-gray-400 text-center py-8">Sin datos de capacidad.</p></Card>
  );

  const { summary, users } = capacity;
  const utilization = Math.round(summary.utilization_pct);
  const utilColor = summary.status === 'overloaded' ? '#ef4444' : summary.status === 'high' ? '#f59e0b' : '#10b981';

  // Por proyecto: agregamos workload usando programs.project_name como base
  const projectAggs: CapacityProjectAgg[] = (() => {
    const map = new Map<string, CapacityProjectAgg>();
    programs.forEach(p => {
      const key = p.project_name ?? '—';
      const ex = map.get(key) ?? { project: key, total: 0, pending: 0, overdue: 0, completed: 0 };
      ex.total      += p.total;
      ex.completed  += p.finished;
      ex.overdue    += p.overdue_count;
      ex.pending     = ex.total - ex.completed;
      map.set(key, ex);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  })();

  return (
    <div className="space-y-6">
      {/* ── Utilización Global ───────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Gauge size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Utilización Global del Equipo</h3>
          <button onClick={() => router.push('/capacidad')} className="ml-auto text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Módulo completo →</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Gauge */}
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-44">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-gray-700" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={utilColor} strokeWidth="10"
                  strokeDasharray={`${(Math.min(100, utilization) / 100) * 264} 264`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-4xl font-bold" style={{ color: utilColor }}>{utilization}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">utilización</p>
              </div>
            </div>
            <p className={`text-xs font-semibold mt-2 ${summary.status === 'overloaded' ? 'text-red-600' : summary.status === 'high' ? 'text-amber-600' : 'text-emerald-600'}`}>
              {summary.status === 'overloaded' ? 'Sobrecargado' : summary.status === 'high' ? 'Alta demanda' : 'Saludable'}
            </p>
          </div>

          {/* Pills */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-4">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">Capacidad utilizada</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary.active_points}<span className="text-xs text-blue-500 ml-1">pts</span></p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                {Math.round((summary.active_points / Math.max(summary.capacity_points, 1)) * 100)}% del total
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10 p-4">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Capacidad libre</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{summary.available_points}<span className="text-xs text-emerald-500 ml-1">pts</span></p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                {Math.round((summary.available_points / Math.max(summary.capacity_points, 1)) * 100)}% disponible
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mb-1">Capacidad total</p>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{summary.capacity_points}<span className="text-xs text-gray-400 ml-1">pts</span></p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{users.length} usuarios activos</p>
            </div>
            <div className={`rounded-xl border p-4 sm:col-span-3 ${summary.overloaded_users > 0 ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10'}`}>
              <div className="flex items-center gap-2">
                {summary.overloaded_users > 0
                  ? <AlertTriangle size={16} className="text-red-500" />
                  : <CheckCircle2 size={16} className="text-emerald-500" />}
                <p className={`text-sm font-semibold ${summary.overloaded_users > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {summary.overloaded_users > 0
                    ? `${summary.overloaded_users} usuario(s) sobreasignado(s) — revisar redistribución`
                    : 'Sin sobreasignaciones — distribución saludable'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Barra acumulada usado vs libre */}
        <div className="mt-5">
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">
            <span>0 pts</span><span className="font-semibold">{summary.capacity_points} pts</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden flex">
            <div className="h-3" style={{ width: `${Math.min(100, utilization)}%`, background: utilColor }} title={`Usado: ${summary.active_points} pts`} />
            <div className="h-3 bg-gray-200 dark:bg-gray-600" style={{ width: `${Math.max(0, 100 - utilization)}%` }} title={`Libre: ${summary.available_points} pts`} />
          </div>
        </div>
      </Card>

      {/* ── Distribución de Carga ──────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <BarChart3 size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Distribución de Carga</h3>
          <div className="ml-auto flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-0.5">
            {(['user', 'role', 'project'] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${groupBy === g ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>
                {g === 'user' ? 'Por usuario' : g === 'role' ? 'Por rol' : 'Por proyecto'}
              </button>
            ))}
          </div>
        </div>

        {groupBy === 'user' && <DistribucionPorUsuario users={users} workload={workload} />}
        {groupBy === 'role'    && <DistribucionPorRol users={users} />}
        {groupBy === 'project' && <DistribucionPorProyecto projects={projectAggs} />}
      </Card>
    </div>
  );
}

function DistribucionPorUsuario({ users, workload }: { users: CapacityUser[]; workload: WorkloadUser[] }) {
  const wlMap = new Map(workload.map(w => [w.user_id, w]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium">
            <th className="text-left pb-2 pr-3">Usuario</th>
            <th className="text-left pb-2 pr-3">Rol</th>
            <th className="text-center pb-2 pr-3">Carga</th>
            <th className="text-center pb-2 pr-3">Vencidas</th>
            <th className="text-center pb-2 pr-3">Completadas</th>
            <th className="text-left pb-2 pr-3 min-w-[160px]">Utilización</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {users.map(u => {
            const wl = wlMap.get(u.user_id);
            const overloaded = u.status === 'overloaded';
            const high       = u.status === 'high';
            const barColor   = overloaded ? '#ef4444' : high ? '#f59e0b' : '#10b981';
            const pct = Math.round(u.utilization_pct);
            return (
              <tr key={u.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: '#194276' }}>
                      {u.user_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[140px]">{u.user_name}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">
                    {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-center text-gray-600 dark:text-gray-400">{wl ? wl.total : '—'}</td>
                <td className="py-2.5 pr-3 text-center">
                  {(wl?.overdue ?? u.overdue) > 0
                    ? <span className="bg-red-50 dark:bg-red-900/20 text-red-600 font-semibold rounded-full px-2 py-0.5">{wl?.overdue ?? u.overdue}</span>
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="py-2.5 pr-3 text-center">
                  <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-semibold rounded-full px-2 py-0.5">{wl?.completed ?? 0}</span>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden min-w-[80px]">
                      <div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
                    </div>
                    <span className={`font-bold w-10 text-right shrink-0 ${overloaded ? 'text-red-600' : high ? 'text-amber-600' : 'text-emerald-600'}`}>{pct}%</span>
                    <span className="text-[10px] text-gray-400 w-20 shrink-0 text-right hidden sm:inline">{u.active_points}/{u.capacity_points} pts</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DistribucionPorRol({ users }: { users: CapacityUser[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Object.entries(ROLE_LABELS).map(([role, label]) => {
        const roleUsers = users.filter(u => u.role === role);
        if (roleUsers.length === 0) return null;
        const avg = Math.round(roleUsers.reduce((s, u) => s + u.utilization_pct, 0) / roleUsers.length);
        const overloaded = roleUsers.filter(u => u.status === 'overloaded').length;
        const totalActive = roleUsers.reduce((s, u) => s + u.active_points, 0);
        const totalCap    = roleUsers.reduce((s, u) => s + u.capacity_points, 0);
        const color = avg > 100 ? '#ef4444' : avg >= 80 ? '#f59e0b' : '#10b981';
        return (
          <div key={role} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                <p className="text-[10px] text-gray-400">{roleUsers.length} persona(s)</p>
              </div>
              {overloaded > 0 && <span className="text-[9px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 shrink-0">{overloaded} ⚠</span>}
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-2xl font-bold" style={{ color }}>{avg}%</p>
              <p className="text-[11px] text-gray-400">{totalActive}/{totalCap} pts</p>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div className="h-2 rounded-full" style={{ width: `${Math.min(100, avg)}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DistribucionPorProyecto({ projects }: { projects: CapacityProjectAgg[] }) {
  if (projects.length === 0) return <p className="text-sm text-gray-400 text-center py-4">Sin datos por proyecto.</p>;
  const maxTotal = Math.max(...projects.map(p => p.total), 1);
  return (
    <div className="space-y-2.5">
      {projects.map(p => {
        const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
        const pendingW = (p.pending  / maxTotal) * 100;
        const overdueW = (p.overdue  / maxTotal) * 100;
        const doneW    = (p.completed / maxTotal) * 100;
        return (
          <div key={p.project}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-gray-700 dark:text-gray-300 truncate flex items-center gap-1.5">
                <FolderKanban size={11} className="text-indigo-500 shrink-0" />{p.project}
              </span>
              <span className="text-gray-500 dark:text-gray-400 shrink-0 ml-2">{p.total} entreg. · {pct}% completado</span>
            </div>
            <div className="flex h-4 rounded-md overflow-hidden gap-px bg-gray-100 dark:bg-gray-700">
              <div className="bg-emerald-500" style={{ width: `${doneW}%` }}     title={`Completados: ${p.completed}`} />
              <div className="bg-blue-400"    style={{ width: `${pendingW}%` }}  title={`Pendientes: ${p.pending}`} />
              <div className="bg-red-500"     style={{ width: `${overdueW}%` }}  title={`Vencidos: ${p.overdue}`} />
            </div>
            <div className="flex gap-3 text-[10px] text-gray-400 mt-1 flex-wrap">
              <span className="text-emerald-600">■ Completados {p.completed}</span>
              <span className="text-blue-500">■ Pendientes {p.pending}</span>
              {p.overdue > 0 && <span className="text-red-500">■ Vencidos {p.overdue}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB: REPORTES (responsive) ───────────────────────────────────────────────

function TabReportes({
  stats, health,
}: {
  stats: DashboardStats | null;
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stacked horizontal bars by role */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Volumen por Etapa del Flujo</h3>
          </div>
          <div className="space-y-3">
            {[...roleDetail].sort((a, b) => b.total - a.total).map(r => {
              const pct = Math.round((r.approved / r.total) * 100) || 0;
              const approvedW = (r.approved / maxRole) * 100;
              const activeW   = (r.active / maxRole)   * 100;
              const overdueW  = (r.overdue / maxRole)  * 100;
              return (
                <div key={r.role}>
                  <div className="flex justify-between text-xs mb-1 flex-wrap gap-2">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}</span>
                    <span className="text-gray-500 dark:text-gray-500">{r.total} total · {pct}% completado</span>
                  </div>
                  <div className="flex h-4 rounded overflow-hidden gap-px bg-gray-100 dark:bg-gray-700">
                    <div className="bg-emerald-400" style={{ width: `${approvedW}%` }} title={`Aprobados: ${r.approved}`} />
                    <div className="bg-blue-400"    style={{ width: `${activeW}%` }}   title={`Activos: ${r.active}`} />
                    <div className="bg-red-400"     style={{ width: `${overdueW}%` }}  title={`Vencidos: ${r.overdue}`} />
                  </div>
                  <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5 flex-wrap">
                    <span className="text-emerald-600">■ Aprobados {r.approved}</span>
                    <span className="text-blue-500">■ Activos {r.active}</span>
                    {r.overdue > 0 && <span className="text-red-500">■ Vencidos {r.overdue}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Donut responsive */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Composición por Estado</h3>
          </div>
          <ResponsiveDonut
            data={Object.entries(byStatus).filter(([,v]) => v > 0).map(([k, v]) => ({ key: k, label: STATUS_INFO[k]?.label ?? k, value: v, color: STATUS_INFO[k]?.color ?? '#9ca3af' }))}
            total={statusTotal}
          />
        </Card>
      </div>

      {/* Program ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

// ─── ResponsiveDonut ──────────────────────────────────────────────────────────

function ResponsiveDonut({ data, total }: { data: { key: string; label: string; value: number; color: string }[]; total: number }) {
  const R = 38, CX = 50, CY = 50, strokeW = 16;
  const circ = 2 * Math.PI * R;
  let cumulative = 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-4 items-center">
      <div className="w-full max-w-[200px] mx-auto">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-auto block">
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
                transform={`rotate(-90 ${CX} ${CY})`}>
                <title>{key}: {value}</title>
              </circle>
            );
          })}
          <text x={CX} y={CY - 1} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100" fontSize="14" fontWeight="bold" style={{ fill: 'currentColor' }}>{total}</text>
          <text x={CX} y={CY + 8} textAnchor="middle" fontSize="6" fill="#9ca3af">total</text>
        </svg>
      </div>
      <div className="space-y-1.5">
        {data.sort((a, b) => b.value - a.value).map(({ key, label, value, color }) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{label}</span>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{value}</span>
            <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round((value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
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
      <div className="p-4 sm:p-6 space-y-6">
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
          <TabResumen stats={stats} health={health} capacity={capacity} onFilter={setPanelFilter} />
        )}
        {activeTab === 'seguimiento' && <TabSeguimiento projects={projects} />}
        {activeTab === 'capacidad'   && <TabCapacidad capacity={capacity} workload={workload} programs={stats.programs_breakdown ?? []} />}
        {activeTab === 'reportes'    && <TabReportes stats={stats} health={health} />}
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
