'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, BookOpen, AlertTriangle, TrendingDown, Users, ChevronRight, ArrowLeft, BarChart3, Clock, CheckCircle2, XCircle, Activity, Gauge } from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { AcademicProgram, Deliverable, DashboardStats, ProgramBreakdown, RoleActivity, Role } from '@/lib/types';
import { ROLE_LABELS, ROLE_STATUS_LABELS } from '@/lib/types';
import PageHeader from '@/components/PageHeader';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import FilteredDetailPanel, { PanelRow } from '@/components/FilteredDetailPanel';
import { isPastDue, isApproaching } from '@/lib/dateStatus';

// ─── Role columns ─────────────────────────────────────────────────────────────
const ROLE_COLS: Array<{ key: Role; abbr: string }> = [
  { key: 'expert', abbr: 'EXP' },
  { key: 'pedagogy', abbr: 'PED' },
  { key: 'design', abbr: 'DIS' },
  { key: 'audiovisual', abbr: 'AUD' },
  { key: 'engineering', abbr: 'ING' },
  { key: 'qa', abbr: 'QA' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function complianceColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-red-500';
}

function complianceBorder(pct: number, overdue = 0): string {
  if (overdue > 0) return 'border-l-red-500';
  if (pct >= 80) return 'border-l-emerald-500';
  if (pct >= 50) return 'border-l-amber-400';
  return 'border-l-[#194276]';
}

function complianceText(pct: number): string {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function roleActivityCircle(status: string): string {
  if (status === 'approved') return 'bg-emerald-500';
  if (status === 'not_started' || status === 'not_applicable') return 'bg-gray-300';
  if (
    status === 'overdue' ||
    status === 'rejected' ||
    status === 'with_findings'
  )
    return 'bg-red-500';
  return 'bg-blue-500';
}

function isOverdue(act: RoleActivity): boolean {
  if (!act.commitment_date) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (
    new Date(act.commitment_date + 'T00:00:00') < today &&
    act.status !== 'approved' &&
    act.status !== 'not_applicable'
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
  });
}

// ─── Program card (left panel) ────────────────────────────────────────────────
type ProgramSort = 'risk' | 'progress' | 'overdue' | 'pending' | 'name';

function riskLevel(pb: ProgramBreakdown): 'critical' | 'risk' | 'healthy' {
  if (pb.overdue_count > 0 || pb.compliance_percentage < 35) return 'critical';
  if (pb.pending_count > 0 || pb.compliance_percentage < 75) return 'risk';
  return 'healthy';
}

function riskScore(pb: ProgramBreakdown) {
  return (pb.overdue_count * 12) + (pb.pending_count * 3) + Math.max(0, 100 - pb.compliance_percentage);
}

function MetricCard({ label, value, tone, icon: Icon, sub }: {
  label: string;
  value: string | number;
  tone: 'blue' | 'red' | 'amber' | 'emerald' | 'slate';
  icon: React.ElementType;
  sub?: string;
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-900/50',
    red: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900/50',
    amber: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/50',
    slate: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  }[tone];
  return (
    <div className={clsx('rounded-xl border p-4', styles)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium opacity-80">{label}</p>
          <p className="text-2xl font-black mt-1">{value}</p>
          {sub && <p className="text-[11px] opacity-70 mt-0.5">{sub}</p>}
        </div>
        <Icon size={20} className="opacity-70" />
      </div>
    </div>
  );
}

function ProgramCard({
  pb,
  selected,
  onClick,
}: {
  pb: ProgramBreakdown;
  selected: boolean;
  onClick: () => void;
}) {
  const pct = pb.compliance_percentage ?? 0;
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left border-l-4 rounded-lg p-3 transition-all border border-gray-200 dark:border-gray-700 hover:shadow-sm',
        complianceBorder(pct, pb.overdue_count),
        selected ? 'bg-[#194276]/5 border-r-[#194276] dark:bg-indigo-900/20' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug">{pb.name}</p>
        <ChevronRight
          size={14}
          className={clsx('flex-shrink-0 mt-0.5 transition-colors', selected ? 'text-[#194276] dark:text-indigo-400' : 'text-gray-400')}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">{pb.project_name}</p>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-gray-500">Cumplimiento</span>
          <span className={clsx('font-bold', complianceText(pct))}>{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx('h-1.5 rounded-full transition-all', complianceColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Counters */}
      <div className="flex gap-3 text-xs">
        <span className="text-gray-500">Total: <strong className="text-gray-700">{pb.total}</strong></span>
        <span className="text-red-500">Venc: <strong>{pb.overdue_count}</strong></span>
        <span className="text-blue-500">Activos: <strong>{pb.active_count}</strong></span>
      </div>
    </button>
  );
}

// ─── Quick indicator card ─────────────────────────────────────────────────────
function QuickCard({
  label,
  value,
  sub,
  colorClass,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  colorClass: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex-1 min-w-[140px]",
        onClick && "cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-700/80 hover:shadow-sm transition-all"
      )}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={clsx('text-2xl font-bold', colorClass)}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Gantt row ────────────────────────────────────────────────────────────────
function GanttRow({
  deliverable,
  index,
}: {
  deliverable: Deliverable;
  index: number;
}) {
  const actsByRole: Record<Role, RoleActivity | undefined> = {
    expert: undefined,
    pedagogy: undefined,
    design: undefined,
    audiovisual: undefined,
    engineering: undefined,
    qa: undefined,
  };
  for (const act of deliverable.role_activities ?? []) {
    actsByRole[act.role] = act;
  }

  return (
    <tr className={clsx(index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/70 dark:bg-gray-700/30')}>
      <td className="px-3 py-2 text-xs text-gray-500 max-w-[100px] truncate whitespace-nowrap" title={deliverable.subject_name}>
        {deliverable.subject_name ?? '—'}
      </td>
      <td className="px-3 py-2 text-xs font-medium text-gray-800 max-w-[140px] truncate whitespace-nowrap" title={deliverable.name}>
        {deliverable.name}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 capitalize whitespace-nowrap">
        {deliverable.type === 'creation' ? 'Creación' : 'Actualización'}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={clsx(
          'inline-flex text-[10px] rounded-full px-2 py-0.5 font-medium',
          deliverable.global_status === 'finished' ? 'bg-emerald-100 text-emerald-700' :
          deliverable.global_status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
          deliverable.global_status === 'in_review' ? 'bg-purple-100 text-purple-700' :
          deliverable.global_status === 'with_observations' ? 'bg-amber-100 text-amber-700' :
          deliverable.global_status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
          'bg-gray-100 text-gray-600'
        )}>
          {deliverable.global_status === 'finished' ? 'Finalizado' :
           deliverable.global_status === 'in_progress' ? 'En Ejecución' :
           deliverable.global_status === 'in_review' ? 'En Revisión' :
           deliverable.global_status === 'with_observations' ? 'Con Obs.' :
           deliverable.global_status === 'pending_start' ? 'Pend. Inicio' :
           deliverable.global_status === 'cancelled' ? 'Cancelado' :
           deliverable.global_status}
        </span>
      </td>
      {ROLE_COLS.map(({ key }) => {
        const act = actsByRole[key];
        const overdue = act ? isOverdue(act) : false;
        const circleColor = act
          ? overdue
            ? 'bg-red-500'
            : roleActivityCircle(act.status)
          : 'bg-gray-200';
        const title = act
          ? `${ROLE_LABELS[key]}: ${ROLE_STATUS_LABELS[act.status] ?? act.status}${act.commitment_date ? ' · ' + formatDate(act.commitment_date) : ''}`
          : `${ROLE_LABELS[key]}: No aplica`;
        return (
          <td key={key} className="px-2 py-2 text-center whitespace-nowrap">
            <div className="flex flex-col items-center gap-0.5" title={title}>
              <span className={clsx('w-3 h-3 rounded-full inline-block', circleColor)} />
              <span className="text-[9px] text-gray-400 leading-none">
                {act?.commitment_date ? formatDate(act.commitment_date) : '—'}
              </span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

// ─── Bottleneck analysis ──────────────────────────────────────────────────────
interface Bottleneck {
  type: 'role_overdue' | 'overloaded';
  label: string;
  detail: string;
}

function analyzeBottlenecks(deliverables: Deliverable[]): Bottleneck[] {
  const roleOverdue: Record<Role, number> = {
    expert: 0, pedagogy: 0, design: 0,
    audiovisual: 0, engineering: 0, qa: 0,
  };
  const responsibleCount: Record<string, number> = {};

  for (const d of deliverables) {
    for (const act of d.role_activities ?? []) {
      if (isOverdue(act)) roleOverdue[act.role]++;
      if (act.responsible?.name) {
        const n = act.responsible.name;
        responsibleCount[n] = (responsibleCount[n] ?? 0) + 1;
      }
    }
  }

  const bottlenecks: Bottleneck[] = [];

  for (const [role, count] of Object.entries(roleOverdue) as Array<[Role, number]>) {
    if (count > 2) {
      bottlenecks.push({
        type: 'role_overdue',
        label: `Rol crítico: ${ROLE_LABELS[role]}`,
        detail: `${count} actividades vencidas en este rol`,
      });
    }
  }

  for (const [name, count] of Object.entries(responsibleCount)) {
    if (count > 5) {
      bottlenecks.push({
        type: 'overloaded',
        label: `Responsable sobrecargado: ${name}`,
        detail: `${count} actividades asignadas en este programa`,
      });
    }
  }

  return bottlenecks;
}

// ─── Detail panel (right) ─────────────────────────────────────────────────────
function ProgramDetail({
  pb,
  deliverables,
  loading,
}: {
  pb: ProgramBreakdown;
  deliverables: Deliverable[];
  loading: boolean;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState('');
  const [panelRows, setPanelRows] = useState<PanelRow[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  const handleCardClick = async (type: 'avance' | 'vencidos' | 'activos' | 'prox') => {
    setPanelOpen(true);
    setPanelLoading(true);
    
    let title = '';
    if (type === 'avance') title = `Entregables — ${pb.name}`;
    else if (type === 'vencidos') title = `Actividades Vencidas — ${pb.name}`;
    else if (type === 'activos') title = `Actividades Activas — ${pb.name}`;
    else if (type === 'prox') title = `Actividades Próximas a Vencer — ${pb.name}`;
    setPanelTitle(title);

    try {
      const data = await api.get<any[]>(`/deliverables?program_id=${pb.id}`);
      if (Array.isArray(data)) {
        if (type === 'avance') {
          setPanelRows(data.map((item, idx) => {
            const acts = item.role_activities ?? [];
            const activeAct = acts.find((a: any) => a.status === 'in_progress' || a.status === 'delivered' || a.status === 'in_review');
            return {
              id: item.id ?? idx,
              name: item.name ?? '—',
              responsible: activeAct?.responsible?.name ?? acts[0]?.responsible?.name ?? '—',
              program: item.program_name ?? '—',
              subject: item.subject_name ?? '—',
              commitment_date: item.start_date ?? undefined,
            };
          }));
        } else {
          const list: PanelRow[] = [];
          for (const d of data) {
            const acts = d.role_activities ?? [];
            for (const act of acts) {
              let matches = false;
              if (type === 'vencidos') {
                matches = isPastDue(act.commitment_date, act.status);
              } else if (type === 'activos') {
                matches = !['approved', 'not_applicable', 'not_started'].includes(act.status);
              } else if (type === 'prox') {
                matches = isApproaching(act.commitment_date, act.status);
              }

              if (matches) {
                const diffTime = act.commitment_date
                  ? new Date(act.commitment_date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)
                  : 0;
                const daysDiff = Math.round(diffTime / 86400000);

                list.push({
                  id: act.id ?? `${d.id}_${act.role}`,
                  name: `${d.subject_name ?? '—'} / ${d.name ?? '—'} (${ROLE_LABELS[act.role as keyof typeof ROLE_LABELS] ?? act.role})`,
                  responsible: act.responsible?.name ?? '—',
                  program: d.program_name ?? '—',
                  subject: d.subject_name ?? '—',
                  commitment_date: act.commitment_date,
                  days_diff: daysDiff,
                  status: act.status,
                  role: act.role,
                });
              }
            }
          }
          setPanelRows(list);
        }
      } else {
        setPanelRows([]);
      }
    } catch {
      setPanelRows([]);
    } finally {
      setPanelLoading(false);
    }
  };

  const pct = Math.round(pb.compliance_percentage ?? 0);
  const nearest = useMemo(() => {
    const today = new Date();
    let soonest: string | null = null;
    for (const d of deliverables) {
      for (const act of d.role_activities ?? []) {
        if (act.commitment_date && act.status !== 'approved') {
          const dt = new Date(act.commitment_date);
          if (dt >= today) {
            if (!soonest || act.commitment_date < soonest) soonest = act.commitment_date;
          }
        }
      }
    }
    return soonest ? formatDate(soonest) : '—';
  }, [deliverables]);

  const bottlenecks = useMemo(() => analyzeBottlenecks(deliverables), [deliverables]);
  const roleDistribution = useMemo(() => ROLE_COLS.map(({ key, abbr }) => ({
    key,
    abbr,
    label: ROLE_LABELS[key],
    total: deliverables.reduce((sum, d) => sum + (d.role_activities ?? []).filter(a => a.role === key && a.status !== 'not_applicable').length, 0),
    overdue: deliverables.reduce((sum, d) => sum + (d.role_activities ?? []).filter(a => a.role === key && isOverdue(a)).length, 0),
  })), [deliverables]);
  const maxRoleTotal = Math.max(1, ...roleDistribution.map(r => r.total));
  const responsibleLoad = useMemo(() => {
    const map = new Map<string, number>();
    deliverables.forEach(d => (d.role_activities ?? []).forEach(a => {
      if (a.responsible?.name && a.status !== 'not_applicable') map.set(a.responsible.name, (map.get(a.responsible.name) ?? 0) + 1);
    }));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [deliverables]);
  const nextMilestones = useMemo(() => {
    const now = new Date();
    return deliverables
      .flatMap(d => (d.role_activities ?? []).map(a => ({ deliverable: d.name, role: ROLE_LABELS[a.role], date: a.commitment_date, overdue: isOverdue(a), status: a.status })))
      .filter(i => i.date && i.status !== 'approved' && i.status !== 'not_applicable')
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .filter(i => i.overdue || new Date(String(i.date)) >= now)
      .slice(0, 6);
  }, [deliverables]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{pb.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{pb.project_name}</p>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className={clsx('text-3xl font-black', complianceText(pct))}>{pct}%</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">{pb.finished} / {pb.total} entregables</span>
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx('h-2 rounded-full', complianceColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Quick indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickCard label="% Avance" value={`${pct}%`} colorClass={complianceText(pct)} onClick={() => handleCardClick('avance')} />
        <QuickCard label="Vencidos" value={pb.overdue_count} colorClass="text-red-600" onClick={() => handleCardClick('vencidos')} />
        <QuickCard label="Activos" value={pb.active_count} colorClass="text-blue-600" onClick={() => handleCardClick('activos')} />
        <QuickCard label="Próx. vencer" value={nearest} colorClass="text-amber-600" onClick={() => handleCardClick('prox')} />
      </div>

      {/* Bottlenecks */}
      {bottlenecks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Cuellos de botella</h3>
          </div>
          <div className="space-y-2">
            {bottlenecks.map((b, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {b.type === 'role_overdue' ? (
                  <TrendingDown size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Users size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium text-gray-800 text-xs">{b.label}</p>
                  <p className="text-xs text-gray-500">{b.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <BarChart3 size={15} className="text-indigo-500" /> Entregables por rol
          </h3>
          <div className="space-y-2">
            {roleDistribution.map(r => (
              <div key={r.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 dark:text-gray-300">{r.label}</span>
                  <span className={r.overdue > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>{r.total} {r.overdue > 0 ? `· ${r.overdue} venc.` : ''}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className={clsx('h-full rounded-full', r.overdue > 0 ? 'bg-red-500' : 'bg-indigo-500')} style={{ width: `${(r.total / maxRoleTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Users size={15} className="text-indigo-500" /> Responsables con más carga
          </h3>
          {responsibleLoad.length === 0 ? <p className="text-xs text-gray-400">Sin responsables asignados.</p> : (
            <div className="space-y-2">
              {responsibleLoad.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{name}</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Clock size={15} className="text-indigo-500" /> Próximos hitos
          </h3>
          {nextMilestones.length === 0 ? <p className="text-xs text-gray-400">Sin hitos pendientes.</p> : (
            <div className="space-y-2">
              {nextMilestones.map((m, i) => (
                <div key={`${m.deliverable}-${m.role}-${i}`} className="flex items-start gap-2">
                  <span className={clsx('mt-1 h-2 w-2 rounded-full shrink-0', m.overdue ? 'bg-red-500' : 'bg-amber-400')} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{m.deliverable}</p>
                    <p className="text-[11px] text-gray-400">{m.role} · {formatDate(m.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gantt table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Seguimiento por Entregable</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Círculos: verde=aprobado · azul=activo · rojo=vencido · gris=no iniciado
          </p>
        </div>

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={4} cols={10} />
          </div>
        ) : deliverables.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Sin entregables registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Asignatura</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Entregable</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Estado</th>
                  {ROLE_COLS.map(({ abbr }) => (
                    <th key={abbr} className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase text-center whitespace-nowrap">
                      {abbr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deliverables.map((d, i) => (
                  <GanttRow key={d.id} deliverable={d} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <FilteredDetailPanel
        isOpen={panelOpen}
        title={panelTitle}
        rows={panelRows}
        loading={panelLoading}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ProgramasPage() {
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [breakdown, setBreakdown] = useState<ProgramBreakdown[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [selectedPb, setSelectedPb] = useState<ProgramBreakdown | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<ProgramSort>('risk');

  // Load program list + breakdown
  useEffect(() => {
    Promise.all([
      api.get<AcademicProgram[]>(ENDPOINTS.PROGRAMS).catch(() => [] as AcademicProgram[]),
      api.get<DashboardStats>(ENDPOINTS.DASHBOARD).catch(() => null),
    ]).then(([progs, dash]) => {
      setPrograms(progs);
      if (dash?.programs_breakdown) {
        setBreakdown(dash.programs_breakdown);
      } else {
        // Build minimal breakdown from programs
        const fallback: ProgramBreakdown[] = progs.map((p) => ({
          id: p.id,
          name: p.name,
          project_id: p.project_id,
          project_name: '—',
          total: p.deliverables_count ?? 0,
          finished: 0,
          compliance_percentage: 0,
          overdue_count: 0,
          active_count: 0,
          pending_count: 0,
        }));
        setBreakdown(fallback);
      }
    }).finally(() => setLoadingList(false));
  }, []);

  // Load deliverables when program is selected
  useEffect(() => {
    if (!selectedPb) return;
    setLoadingDetail(true);
    setDeliverables([]);
    api
      .get<Deliverable[]>(`${ENDPOINTS.DELIVERABLES}?project_id=${selectedPb.project_id}`)
      .then((all) => {
        const filtered = all.filter(
          (d) => d.program_id === selectedPb.id || d.program_name === selectedPb.name
        );
        setDeliverables(filtered.length > 0 ? filtered : all);
      })
      .catch(() => setDeliverables([]))
      .finally(() => setLoadingDetail(false));
  }, [selectedPb]);

  const filtered = useMemo(() => {
    const base = !search ? breakdown : breakdown.filter(
      (pb) =>
        pb.name.toLowerCase().includes(search.toLowerCase()) ||
        pb.project_name.toLowerCase().includes(search.toLowerCase())
    );
    return [...base].sort((a, b) => {
      if (sortBy === 'risk') return riskScore(b) - riskScore(a);
      if (sortBy === 'progress') return b.compliance_percentage - a.compliance_percentage;
      if (sortBy === 'overdue') return b.overdue_count - a.overdue_count;
      if (sortBy === 'pending') return b.pending_count - a.pending_count;
      return a.name.localeCompare(b.name);
    });
  }, [breakdown, search, sortBy]);

  const summary = useMemo(() => {
    const total = breakdown.length;
    const critical = breakdown.filter(pb => riskLevel(pb) === 'critical').length;
    const risk = breakdown.filter(pb => riskLevel(pb) === 'risk').length;
    const healthy = breakdown.filter(pb => riskLevel(pb) === 'healthy').length;
    const overdue = breakdown.reduce((sum, pb) => sum + pb.overdue_count, 0);
    const pending = breakdown.reduce((sum, pb) => sum + pb.pending_count, 0);
    const active = breakdown.reduce((sum, pb) => sum + pb.active_count, 0);
    const avg = total ? Math.round(breakdown.reduce((sum, pb) => sum + pb.compliance_percentage, 0) / total) : 0;
    return { total, critical, risk, healthy, overdue, pending, active, avg };
  }, [breakdown]);

  const topRisk = filtered[0];

  /*
  const filteredLegacy = useMemo(() => {
    if (!search) return breakdown;
    const q = search.toLowerCase();
    return breakdown.filter(
      (pb) =>
        pb.name.toLowerCase().includes(q) ||
        pb.project_name.toLowerCase().includes(q)
    );
  }, [breakdown, search, programs]);
  */

  // Mobile view state: when a program is selected on small screens, hide the list
  const showListOnMobile = !selectedPb;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Programas Académicos"
        subtitle="Vista ejecutiva de seguimiento por programa"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Programas Académicos' }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
        <MetricCard label="Programas" value={summary.total} tone="slate" icon={BookOpen} />
        <MetricCard label="Críticos" value={summary.critical} tone="red" icon={XCircle} />
        <MetricCard label="En riesgo" value={summary.risk} tone="amber" icon={AlertTriangle} />
        <MetricCard label="Al día" value={summary.healthy} tone="emerald" icon={CheckCircle2} />
        <MetricCard label="Vencidos" value={summary.overdue} tone="red" icon={Clock} />
        <MetricCard label="Pendientes" value={summary.pending} tone="blue" icon={Activity} />
        <MetricCard label="Avance prom." value={`${summary.avg}%`} tone="blue" icon={Gauge} />
      </div>

      {topRisk && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/25">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-amber-600 dark:text-amber-300" size={18} />
              <div>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Prioridad ejecutiva</p>
                <p className="text-sm text-amber-800 dark:text-amber-200">{topRisk.name} concentra el mayor nivel de riesgo por vencidos, pendientes y avance.</p>
              </div>
            </div>
            <button onClick={() => setSelectedPb(topRisk)} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700">
              Revisar programa
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(420px,520px)_1fr] gap-4 lg:gap-5 mt-2 items-start" style={{ minHeight: '70vh' }}>
        {/* ── Left: program list ── */}
        <div className={clsx('flex-col gap-3', showListOnMobile ? 'flex' : 'hidden lg:flex')}>
          {/* Header + counter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-[#194276] dark:text-indigo-400" />
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Ranking ejecutivo</span>
            </div>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5">
              {filtered.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar programa..."
              className="pl-8 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg w-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#194276]/30 focus:border-[#194276]"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ProgramSort)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#194276]/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="risk">Ordenar por criticidad</option>
            <option value="overdue">Más vencidos</option>
            <option value="pending">Más pendientes</option>
            <option value="progress">Mayor avance</option>
            <option value="name">Nombre</option>
          </select>

          {/* List */}
          {loadingList ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto lg:max-h-[calc(100vh-360px)] pr-1">
              {filtered.map((pb) => (
                <ProgramCard
                  key={pb.id}
                  pb={pb}
                  selected={selectedPb?.id === pb.id}
                  onClick={() => setSelectedPb(selectedPb?.id === pb.id ? null : pb)}
                />
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-8">
                  No se encontraron programas.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: detail ── */}
        <div className={clsx('min-w-0', showListOnMobile ? 'hidden lg:block' : 'block')}>
          {/* Mobile back button */}
          {selectedPb && (
            <button
              onClick={() => setSelectedPb(null)}
              className="lg:hidden mb-3 inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <ArrowLeft size={14} /> Volver a programas
            </button>
          )}
          {!selectedPb ? (
            <div className="hidden lg:flex flex-col items-center justify-center h-80 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <BookOpen size={40} className="text-gray-200 dark:text-gray-600 mb-3" />
              <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">Selecciona un programa</p>
              <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">para ver el seguimiento detallado</p>
            </div>
          ) : (
            <ProgramDetail pb={selectedPb} deliverables={deliverables} loading={loadingDetail} />
          )}
        </div>
      </div>
    </div>
  );
}
