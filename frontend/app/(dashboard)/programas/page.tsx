'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, BookOpen, AlertTriangle, TrendingDown, Users, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { AcademicProgram, Deliverable, DashboardStats, ProgramBreakdown, RoleActivity, Role } from '@/lib/types';
import { ROLE_LABELS, ROLE_STATUS_LABELS } from '@/lib/types';
import { MOCK_PROGRAMS } from '@/lib/mock-data';
import PageHeader from '@/components/PageHeader';
import { TableSkeleton } from '@/components/LoadingSkeleton';

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
  return (
    new Date(act.commitment_date) < new Date() &&
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
        'w-full text-left border-l-4 rounded-lg p-3 transition-all border border-gray-200 hover:shadow-sm',
        complianceBorder(pct, pb.overdue_count),
        selected ? 'bg-[#194276]/5 border-r-[#194276]' : 'bg-white hover:bg-gray-50'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-semibold text-gray-900 text-sm leading-snug">{pb.name}</p>
        <ChevronRight
          size={14}
          className={clsx('flex-shrink-0 mt-0.5 transition-colors', selected ? 'text-[#194276]' : 'text-gray-400')}
        />
      </div>
      <p className="text-xs text-gray-500 mb-2 truncate">{pb.project_name}</p>

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
}: {
  label: string;
  value: string | number;
  sub?: string;
  colorClass: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1 min-w-0">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
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
    <tr className={clsx(index % 2 === 0 ? 'bg-white' : 'bg-gray-50/70')}>
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

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{pb.name}</h2>
            <p className="text-sm text-gray-500">{pb.project_name}</p>
          </div>
          <div className="flex flex-col items-end">
            <span className={clsx('text-3xl font-black', complianceText(pct))}>{pct}%</span>
            <span className="text-xs text-gray-400">{pb.finished} / {pb.total} entregables</span>
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx('h-2 rounded-full', complianceColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Quick indicators */}
      <div className="flex gap-3 flex-wrap">
        <QuickCard label="% Avance" value={`${pct}%`} colorClass={complianceText(pct)} />
        <QuickCard label="Vencidos" value={pb.overdue_count} colorClass="text-red-600" />
        <QuickCard label="Activos" value={pb.active_count} colorClass="text-blue-600" />
        <QuickCard label="Próx. vencer" value={nearest} colorClass="text-amber-600" />
      </div>

      {/* Bottlenecks */}
      {bottlenecks.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-700">Cuellos de botella</h3>
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

      {/* Gantt table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Seguimiento por Entregable</h3>
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

  // Load program list + breakdown
  useEffect(() => {
    Promise.all([
      api.get<AcademicProgram[]>(ENDPOINTS.PROGRAMS).catch(() => MOCK_PROGRAMS as AcademicProgram[]),
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
    if (!search) return breakdown;
    const q = search.toLowerCase();
    return breakdown.filter(
      (pb) =>
        pb.name.toLowerCase().includes(q) ||
        pb.project_name.toLowerCase().includes(q)
    );
  }, [breakdown, search, programs]);

  return (
    <div className="p-6">
      <PageHeader
        title="Programas Académicos"
        subtitle="Vista ejecutiva de seguimiento por programa"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Programas Académicos' }]}
      />

      <div className="flex gap-5 items-start mt-2" style={{ minHeight: '70vh' }}>
        {/* ── Left: program list ── */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          {/* Header + counter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-[#194276]" />
              <span className="font-semibold text-gray-900 text-sm">Programas</span>
            </div>
            <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
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
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-[#194276]/30 focus:border-[#194276]"
            />
          </div>

          {/* List */}
          {loadingList ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]">
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
        <div className="flex-1 min-w-0">
          {!selectedPb ? (
            <div className="flex flex-col items-center justify-center h-80 text-center">
              <BookOpen size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm font-medium">Selecciona un programa</p>
              <p className="text-gray-300 text-xs mt-1">para ver el seguimiento detallado</p>
            </div>
          ) : (
            <ProgramDetail pb={selectedPb} deliverables={deliverables} loading={loadingDetail} />
          )}
        </div>
      </div>
    </div>
  );
}
