'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Eye,
  MessageCircle,
  FileText,
  CheckCircle2,
  Send,
  RotateCcw,
  X,
  Download,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Clock,
  Filter,
  LayoutList,
  Layers,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { api, ENDPOINTS, downloadCsv } from '@/lib/api';
import type { Deliverable, RoleActivity, Comment, Role } from '@/lib/types';
import {
  GLOBAL_STATUS_LABELS,
  DELIVERABLE_TYPE_LABELS,
  ROLE_LABELS,
} from '@/lib/types';
import { MOCK_DELIVERABLES } from '@/lib/mock-data';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { clsx } from 'clsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: Role[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];
const ROLE_ABBR: Record<Role, string> = {
  expert: 'EXP',
  pedagogy: 'PED',
  design: 'DIS',
  audiovisual: 'AUD',
  engineering: 'ING',
  qa: 'QA',
};

type QuickAction = 'approve' | 'deliver' | 'request_adjustments';

// ─── Helper: date utilities ───────────────────────────────────────────────────

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function dateColorClass(days: number | null): string {
  if (days === null) return 'text-gray-400';
  if (days < 0) return 'text-red-600 font-semibold';
  if (days <= 3) return 'text-orange-500 font-semibold';
  return 'text-emerald-600';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

// ─── Flow indicator ───────────────────────────────────────────────────────────

function FlowIndicator({ activities }: { activities: RoleActivity[] }) {
  const byRole: Record<string, string> = {};
  activities.forEach((a) => { byRole[a.role] = a.status; });

  // Determine active role (first non-approved, non-not_applicable that has started)
  const activeRole = ROLES.find((r) => {
    const s = byRole[r];
    return s && s !== 'approved' && s !== 'not_applicable' && s !== 'not_started';
  });

  return (
    <div className="flex items-center gap-0.5 min-w-[170px]">
      {ROLES.map((role, idx) => {
        const status = byRole[role] ?? 'not_started';
        const isApproved = status === 'approved';
        const isActive = role === activeRole;
        const isNA = status === 'not_applicable';

        return (
          <span key={role} className="flex items-center gap-0.5">
            <span
              title={`${ROLE_LABELS[role]}: ${status}`}
              className={clsx(
                'inline-flex items-center justify-center rounded px-1 py-0.5 text-[9px] font-bold text-white leading-none',
                isNA ? 'bg-gray-200 !text-gray-400' :
                isApproved ? 'bg-emerald-500' :
                isActive ? 'bg-blue-500 animate-pulse' :
                'bg-gray-200 !text-gray-400'
              )}
            >
              {ROLE_ABBR[role]}
            </span>
            {idx < ROLES.length - 1 && (
              <ChevronRight size={8} className="text-gray-300 shrink-0" />
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct?: number }) {
  const value = pct ?? 0;
  return (
    <div className="flex items-center gap-1.5 min-w-[70px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            value >= 100 ? 'bg-emerald-500' :
            value >= 60 ? 'bg-blue-500' :
            value >= 30 ? 'bg-orange-400' :
            'bg-gray-300'
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-7 text-right">{value}%</span>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastMsg {
  id: number;
  message: string;
  type: 'success' | 'error';
}

function Toast({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white animate-in fade-in slide-in-from-bottom-2',
            t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────

type PanelTab = 'info' | 'flow' | 'comments';

interface SidePanelProps {
  deliverable: Deliverable;
  defaultTab?: PanelTab;
  onClose: () => void;
}

function SidePanel({ deliverable, defaultTab = 'info', onClose }: SidePanelProps) {
  const [tab, setTab] = useState<PanelTab>(defaultTab);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab, deliverable.id]);

  useEffect(() => {
    if (tab === 'comments') {
      setLoadingComments(true);
      api
        .get<Comment[]>(ENDPOINTS.DELIVERABLE_COMMENTS(deliverable.id))
        .then(setComments)
        .catch(() => setComments([]))
        .finally(() => setLoadingComments(false));
    }
  }, [tab, deliverable.id]);

  const tabs: { key: PanelTab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'flow', label: 'Flujo' },
    { key: 'comments', label: 'Comentarios' },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[520px] bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-xs text-gray-400 mb-0.5">
              {deliverable.project_name ?? '—'} / {deliverable.program_name ?? '—'}
            </p>
            <h2 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
              {deliverable.name}
            </h2>
            <p className="text-xs text-gray-500 mt-1">{deliverable.subject_name ?? '—'}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'py-2.5 px-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.key
                  ? 'border-[#194276] text-[#194276]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="Estado">
                  <StatusBadge status={deliverable.global_status} type="global" />
                </InfoItem>
                <InfoItem label="Tipo">
                  <span className={clsx(
                    'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                    deliverable.type === 'creation'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-amber-100 text-amber-700'
                  )}>
                    {DELIVERABLE_TYPE_LABELS[deliverable.type]}
                  </span>
                </InfoItem>
                <InfoItem label="Avance">
                  <ProgressBar pct={deliverable.compliance_percentage} />
                </InfoItem>
                <InfoItem label="Inicio">
                  <span className="text-sm text-gray-700">{formatDate(deliverable.start_date)}</span>
                </InfoItem>
              </div>
              {deliverable.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Notas</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{deliverable.notes}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'flow' && (
            <div className="space-y-2">
              {ROLES.map((role) => {
                const act = (deliverable.role_activities ?? []).find((a) => a.role === role);
                const statusLabel = act?.status
                  ? (act.status.charAt(0).toUpperCase() + act.status.slice(1).replace(/_/g, ' '))
                  : 'Sin iniciar';
                const days = daysUntil(act?.commitment_date);

                return (
                  <div
                    key={role}
                    className={clsx(
                      'rounded-lg border p-3',
                      !act || act.status === 'not_started' ? 'border-gray-100 bg-gray-50' :
                      act.status === 'approved' ? 'border-emerald-100 bg-emerald-50' :
                      act.status === 'not_applicable' ? 'border-gray-100 bg-gray-50 opacity-50' :
                      'border-blue-100 bg-blue-50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">{ROLE_LABELS[role]}</span>
                      <span className="text-xs text-gray-500">{statusLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{act?.responsible?.name ?? '—'}</span>
                      {act?.commitment_date && (
                        <span className={dateColorClass(days)}>
                          {formatDate(act.commitment_date)}
                          {days !== null && ` (${days > 0 ? `${days}d` : `${Math.abs(days)}d atrás`})`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'comments' && (
            <div>
              {loadingComments ? (
                <div className="text-center py-10 text-gray-400 text-sm">Cargando comentarios…</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Sin comentarios</div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-800">{c.user.name}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase mb-1">{label}</p>
      {children}
    </div>
  );
}

// ─── Quick action button ──────────────────────────────────────────────────────

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'success' | 'warning';
}

function ActionBtn({ icon, label, onClick, variant = 'default' }: ActionBtnProps) {
  return (
    <button
      title={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={clsx(
        'p-1.5 rounded-md transition-colors',
        variant === 'success' && 'text-emerald-600 hover:bg-emerald-50',
        variant === 'warning' && 'text-orange-500 hover:bg-orange-50',
        variant === 'default' && 'text-gray-500 hover:bg-gray-100',
      )}
    >
      {icon}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PanelState {
  deliverable: Deliverable;
  tab: PanelTab;
}

export default function EntregablesPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('grouped');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Apply URL filter params on mount (from dashboard navigation)
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (!filter) return;
    if (filter === 'overdue') {
      setOnlyOverdue(true);
    } else if (filter === 'approaching') {
      // Handled in the filter logic below via date check
      setOnlyOverdue(false);
    } else if (filter === 'with_observations') {
      setFilterStatus('with_observations');
    } else if (filter.startsWith('status_')) {
      setFilterStatus(filter.replace('status_', ''));
    } else if (filter.startsWith('role_')) {
      // Role filter: filter by responsible role
      setFilterResponsible(filter.replace('role_', ''));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const loadData = useCallback(() => {
    api
      .get<Deliverable[]>(ENDPOINTS.DELIVERABLES)
      .then(setData)
      .catch(() => setData(MOCK_DELIVERABLES))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived filter options
  const projects = Array.from(new Set(data.map((d) => d.project_name).filter(Boolean))) as string[];
  const responsibles = Array.from(
    new Set(
      data.flatMap((d) =>
        (d.role_activities ?? [])
          .map((a) => a.responsible?.name)
          .filter(Boolean)
      )
    )
  ) as string[];

  // Active role (first non-approved, non-na activity)
  function getActiveActivity(d: Deliverable): RoleActivity | undefined {
    return (d.role_activities ?? []).find(
      (a) => a.status !== 'approved' && a.status !== 'not_applicable' && a.status !== 'not_started'
    );
  }

  function getNextActivity(d: Deliverable): RoleActivity | undefined {
    const acts = d.role_activities ?? [];
    const activeIdx = acts.findIndex(
      (a) => a.status !== 'approved' && a.status !== 'not_applicable' && a.status !== 'not_started'
    );
    if (activeIdx === -1) return undefined;
    return acts.slice(activeIdx + 1).find(
      (a) => a.status !== 'not_applicable'
    );
  }

  // Filters
  const filtered = data.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !d.name.toLowerCase().includes(q) &&
        !(d.subject_name ?? '').toLowerCase().includes(q) &&
        !(d.project_name ?? '').toLowerCase().includes(q) &&
        !(d.program_name ?? '').toLowerCase().includes(q)
      ) return false;
    }
    if (filterProject && d.project_name !== filterProject) return false;
    if (filterStatus && d.global_status !== filterStatus) return false;
    if (filterResponsible) {
      const hasResponsible = (d.role_activities ?? []).some(
        (a) => a.responsible?.name === filterResponsible
      );
      if (!hasResponsible) return false;
    }
    if (onlyOverdue) {
      const active = getActiveActivity(d);
      const days = daysUntil(active?.commitment_date);
      if (days === null || days >= 0) return false;
    }
    return true;
  });

  // Grouping by program
  const grouped = useMemo(() => {
    const map = new Map<string, { programName: string; projectName: string; items: Deliverable[] }>();
    for (const d of filtered) {
      const key = d.program_name ?? '(Sin programa)';
      if (!map.has(key)) {
        map.set(key, { programName: key, projectName: d.project_name ?? '—', items: [] });
      }
      map.get(key)!.items.push(d);
    }
    return Array.from(map.values()).sort((a, b) => a.programName.localeCompare(b.programName));
  }, [filtered]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Quick actions
  async function handleQuickAction(deliverable: Deliverable, action: QuickAction) {
    const active = getActiveActivity(deliverable);
    if (!active) {
      addToast('No hay actividad activa para realizar esta acción.', 'error');
      return;
    }
    try {
      await api.post(ENDPOINTS.ACTIVITY_QUICK_ACTION(active.id), { action });
      addToast(
        action === 'approve' ? 'Entregable aprobado correctamente.' :
        action === 'deliver' ? 'Entregable entregado correctamente.' :
        'Ajustes solicitados correctamente.',
        'success'
      );
      loadData();
    } catch {
      addToast('Error al ejecutar la acción. Intenta de nuevo.', 'error');
    }
  }

  function canApprove(d: Deliverable): boolean {
    const s = d.global_status;
    return s === 'in_review' || s === 'with_observations';
  }

  function canDeliver(d: Deliverable): boolean {
    return d.global_status === 'in_progress';
  }

  function canRequestAdjustments(d: Deliverable): boolean {
    return d.global_status === 'in_review';
  }

  async function handleExport() {
    try {
      await downloadCsv(ENDPOINTS.EXPORT_DELIVERABLES, 'entregables.csv');
      addToast('Exportación iniciada.', 'success');
    } catch {
      addToast('Error al exportar.', 'error');
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Entregables"
        subtitle="Centro operativo — seguimiento y acciones sobre todos los entregables"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Entregables' }]}
      />

      {/* Filters bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyecto, programa, asignatura..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-[#194276]/30"
          />
        </div>

        {/* Project filter */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30 min-w-[160px]"
        >
          <option value="">Todos los proyectos</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30 min-w-[160px]"
        >
          <option value="">Todos los estados</option>
          {Object.entries(GLOBAL_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Responsible filter */}
        <select
          value={filterResponsible}
          onChange={(e) => setFilterResponsible(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30 min-w-[160px]"
        >
          <option value="">Todos los responsables</option>
          {responsibles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Only overdue */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 accent-red-500"
          />
          <span className="text-sm text-gray-600 flex items-center gap-1">
            <AlertCircle size={13} className="text-red-500" />
            Solo vencidas
          </span>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {/* Result count */}
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>

          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grouped')}
              title="Vista agrupada por programa"
              className={clsx(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'grouped' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Layers size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Vista tabla"
              className={clsx(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <LayoutList size={15} />
            </button>
          </div>

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#194276] hover:bg-[#14325c] rounded-lg transition-colors"
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Loading skeleton (shared) */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <TableSkeleton rows={8} cols={9} />
        </div>
      )}

      {/* Grouped view */}
      {viewMode === 'grouped' && !loading && (
        <div className="space-y-3">
          {grouped.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
              <Filter size={32} className="mx-auto mb-2 opacity-30" />
              No se encontraron entregables con los filtros aplicados.
            </div>
          )}
          {grouped.map((group) => {
            const isCollapsed = collapsedGroups.has(group.programName);
            const overdue = group.items.filter((d) => {
              const active = (d.role_activities ?? []).find(
                (a) => a.status !== 'approved' && a.status !== 'not_applicable' && a.status !== 'not_started'
              );
              return active?.commitment_date && daysUntil(active.commitment_date) !== null && (daysUntil(active.commitment_date) ?? 0) < 0;
            }).length;
            const avgPct = group.items.length > 0
              ? Math.round(group.items.reduce((s, d) => s + (d.compliance_percentage ?? 0), 0) / group.items.length)
              : 0;

            return (
              <div key={group.programName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.programName)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <ChevronDown
                    size={16}
                    className={clsx('text-gray-400 transition-transform flex-shrink-0', isCollapsed && '-rotate-90')}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{group.programName}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{group.projectName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                    <span className="text-gray-500">{group.items.length} entregable{group.items.length !== 1 ? 's' : ''}</span>
                    {overdue > 0 && (
                      <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 font-semibold rounded-full px-2 py-0.5">
                        <AlertCircle size={10} /> {overdue} vencida{overdue !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className={clsx(
                      'rounded-full px-2 py-0.5 font-semibold',
                      avgPct >= 70 ? 'bg-emerald-100 text-emerald-700' :
                      avgPct >= 40 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    )}>{avgPct}% avance</span>
                  </div>
                </button>

                {/* Group rows */}
                {!isCollapsed && (
                  <div className="overflow-x-auto border-t border-gray-100">
                    <table className="w-full text-sm min-w-[1100px]">
                      <thead className="bg-gray-50/70 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Flujo</th>
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Asignatura</th>
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Tipo</th>
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Estado</th>
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Resp. Actual</th>
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Próx. Resp.</th>
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">F. Compromiso</th>
                          <th className="text-center px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Días</th>
                          <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">% Avance</th>
                          <th className="sticky right-0 bg-gray-50/70 text-center px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((d) => {
                          const acts = d.role_activities ?? [];
                          const active = (acts).find(
                            (a) => a.status !== 'approved' && a.status !== 'not_applicable' && a.status !== 'not_started'
                          );
                          const next = (() => {
                            const activeIdx = acts.findIndex(
                              (a) => a.status !== 'approved' && a.status !== 'not_applicable' && a.status !== 'not_started'
                            );
                            if (activeIdx === -1) return undefined;
                            return acts.slice(activeIdx + 1).find((a) => a.status !== 'not_applicable');
                          })();
                          const days = daysUntil(active?.commitment_date);
                          return (
                            <tr key={d.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                              <td className="px-3 py-2.5"><FlowIndicator activities={acts} /></td>
                              <td className="px-3 py-2.5 text-gray-800 text-xs max-w-[180px]">
                                <span className="block truncate font-medium" title={d.subject_name ?? d.name}>{d.subject_name ?? d.name}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={clsx(
                                  'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap',
                                  d.type === 'creation' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                                )}>
                                  {DELIVERABLE_TYPE_LABELS[d.type]}
                                </span>
                              </td>
                              <td className="px-3 py-2.5"><StatusBadge status={d.global_status} type="global" /></td>
                              <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[110px]">
                                {active ? (
                                  <div>
                                    <div className="truncate font-medium">{active.responsible?.name ?? '—'}</div>
                                    <div className="text-[10px] text-gray-400">{ROLE_LABELS[active.role]}</div>
                                  </div>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[110px]">
                                {next ? (
                                  <div>
                                    <div className="truncate">{next.responsible?.name ?? '—'}</div>
                                    <div className="text-[10px] text-gray-400">{ROLE_LABELS[next.role]}</div>
                                  </div>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                                <span className={dateColorClass(days)}>{formatDate(active?.commitment_date)}</span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {days !== null ? (
                                  <span className={clsx('text-xs font-semibold', dateColorClass(days))}>
                                    {days > 0 ? `+${days}` : days}
                                  </span>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-3 py-2.5"><ProgressBar pct={d.compliance_percentage} /></td>
                              <td className="sticky right-0 bg-white px-2 py-2.5">
                                <div className="flex items-center justify-center gap-0.5">
                                  <ActionBtn icon={<Eye size={14} />} label="Ver detalle" onClick={() => setPanel({ deliverable: d, tab: 'info' })} />
                                  <ActionBtn icon={<MessageCircle size={14} />} label="Comentar" onClick={() => setPanel({ deliverable: d, tab: 'comments' })} />
                                  <ActionBtn icon={<FileText size={14} />} label="Ver evidencias" onClick={() => setPanel({ deliverable: d, tab: 'flow' })} />
                                  {canApprove(d) && (
                                    <ActionBtn icon={<CheckCircle2 size={14} />} label="Aprobar" variant="success" onClick={() => handleQuickAction(d, 'approve')} />
                                  )}
                                  {canDeliver(d) && (
                                    <ActionBtn icon={<Send size={14} />} label="Entregar" variant="success" onClick={() => handleQuickAction(d, 'deliver')} />
                                  )}
                                  {canRequestAdjustments(d) && (
                                    <ActionBtn icon={<RotateCcw size={14} />} label="Solicitar ajustes" variant="warning" onClick={() => handleQuickAction(d, 'request_adjustments')} />
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {/* Footer */}
          <div className="px-5 py-2 text-xs text-gray-400 flex items-center gap-3">
            <Clock size={12} />
            {filtered.length} de {data.length} entregable{data.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Table */}
      {viewMode === 'table' && !loading && <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {(
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Flujo</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase">Proyecto</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase">Programa</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase">Asignatura</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase">Entregable</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase">Tipo</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase">Estado</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Resp. Actual</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Próx. Resp.</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">F. Compromiso</th>
                    <th className="text-center px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Días Rest.</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">% Avance</th>
                    <th className="sticky right-0 bg-gray-50 text-center px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const acts = d.role_activities ?? [];
                    const active = getActiveActivity(d);
                    const next = getNextActivity(d);
                    const days = daysUntil(active?.commitment_date);

                    return (
                      <tr
                        key={d.id}
                        className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors"
                      >
                        {/* Flujo visual */}
                        <td className="px-3 py-3">
                          <FlowIndicator activities={acts} />
                        </td>

                        {/* Proyecto */}
                        <td className="px-3 py-3 text-gray-600 text-xs max-w-[110px]">
                          <span className="block truncate" title={d.project_name ?? ''}>
                            {d.project_name ?? '—'}
                          </span>
                        </td>

                        {/* Programa */}
                        <td className="px-3 py-3 text-gray-600 text-xs max-w-[110px]">
                          <span className="block truncate" title={d.program_name ?? ''}>
                            {d.program_name ?? '—'}
                          </span>
                        </td>

                        {/* Asignatura */}
                        <td className="px-3 py-3 text-gray-700 text-xs max-w-[110px]">
                          <span className="block truncate" title={d.subject_name ?? ''}>
                            {d.subject_name ?? '—'}
                          </span>
                        </td>

                        {/* Entregable */}
                        <td className="px-3 py-3 font-semibold text-gray-900 max-w-[160px]">
                          <span className="block truncate" title={d.name}>{d.name}</span>
                        </td>

                        {/* Tipo */}
                        <td className="px-3 py-3">
                          <span className={clsx(
                            'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap',
                            d.type === 'creation'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-amber-100 text-amber-700'
                          )}>
                            {DELIVERABLE_TYPE_LABELS[d.type]}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-3">
                          <StatusBadge status={d.global_status} type="global" />
                        </td>

                        {/* Responsable actual */}
                        <td className="px-3 py-3 text-xs text-gray-700 max-w-[110px]">
                          {active ? (
                            <div>
                              <div className="truncate font-medium" title={active.responsible?.name}>
                                {active.responsible?.name ?? '—'}
                              </div>
                              <div className="text-[10px] text-gray-400">{ROLE_LABELS[active.role]}</div>
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Próximo responsable */}
                        <td className="px-3 py-3 text-xs text-gray-500 max-w-[110px]">
                          {next ? (
                            <div>
                              <div className="truncate" title={next.responsible?.name}>
                                {next.responsible?.name ?? '—'}
                              </div>
                              <div className="text-[10px] text-gray-400">{ROLE_LABELS[next.role]}</div>
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Fecha compromiso */}
                        <td className="px-3 py-3 text-xs whitespace-nowrap">
                          <span className={dateColorClass(days)}>
                            {formatDate(active?.commitment_date)}
                          </span>
                        </td>

                        {/* Días restantes */}
                        <td className="px-3 py-3 text-center">
                          {days !== null ? (
                            <span className={clsx('text-xs font-semibold', dateColorClass(days))}>
                              {days > 0 ? `+${days}` : days}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* % Avance */}
                        <td className="px-3 py-3">
                          <ProgressBar pct={d.compliance_percentage} />
                        </td>

                        {/* Acciones */}
                        <td className="sticky right-0 bg-white px-2 py-3">
                          <div className="flex items-center justify-center gap-0.5">
                            <ActionBtn
                              icon={<Eye size={14} />}
                              label="Ver detalle"
                              onClick={() => setPanel({ deliverable: d, tab: 'info' })}
                            />
                            <ActionBtn
                              icon={<MessageCircle size={14} />}
                              label="Comentar"
                              onClick={() => setPanel({ deliverable: d, tab: 'comments' })}
                            />
                            <ActionBtn
                              icon={<FileText size={14} />}
                              label="Ver evidencias"
                              onClick={() => setPanel({ deliverable: d, tab: 'flow' })}
                            />
                            {canApprove(d) && (
                              <ActionBtn
                                icon={<CheckCircle2 size={14} />}
                                label="Aprobar"
                                variant="success"
                                onClick={() => handleQuickAction(d, 'approve')}
                              />
                            )}
                            {canDeliver(d) && (
                              <ActionBtn
                                icon={<Send size={14} />}
                                label="Entregar"
                                variant="success"
                                onClick={() => handleQuickAction(d, 'deliver')}
                              />
                            )}
                            {canRequestAdjustments(d) && (
                              <ActionBtn
                                icon={<RotateCcw size={14} />}
                                label="Solicitar ajustes"
                                variant="warning"
                                onClick={() => handleQuickAction(d, 'request_adjustments')}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={13} className="text-center py-14 text-gray-400 text-sm">
                        <Filter size={32} className="mx-auto mb-2 opacity-30" />
                        No se encontraron entregables con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 text-xs text-gray-400 border-t border-gray-100 flex items-center gap-3">
              <Clock size={12} />
              {filtered.length} de {data.length} entregable{data.length !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>}

      {/* Side panel */}
      {panel && (
        <SidePanel
          deliverable={panel.deliverable}
          defaultTab={panel.tab}
          onClose={() => setPanel(null)}
        />
      )}

      {/* Toasts */}
      <Toast toasts={toasts} />
    </div>
  );
}
