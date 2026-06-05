'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RotateCcw,
  Eye,
  Loader2,
  Send,
  ThumbsUp,
  MessageSquareWarning,
} from 'lucide-react';
import { api, ENDPOINTS } from '@/lib/api';
import type { Workspace, WorkspaceActivity } from '@/lib/types';
import { MOCK_WORKSPACE } from '@/lib/mock-data';
import { ROLE_LABELS, DELIVERABLE_TYPE_LABELS, ROLE_STATUS_LABELS, USER_ROLE_LABELS } from '@/lib/types';
import SidePanel from './SidePanel';
import DeliverableFlow, { type FlowStep } from './DeliverableFlow';
import CommentThread from './CommentThread';
import NextResponsibleCard from './NextResponsibleCard';

// ─── helpers ────────────────────────────────────────────────────────────────

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

type StatFilter = 'pending' | 'in_process' | 'in_review' | 'returned' | 'approved' | 'overdue' | null;

function getPriorityBadge(act: WorkspaceActivity) {
  if (act.date_status === 'overdue') {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">Vencida</span>;
  }
  if (act.date_status === 'approaching') {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">Por vencer</span>;
  }
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">Normal</span>;
}

function getStatusBadge(status: string) {
  const COLORS: Record<string, string> = {
    in_progress: 'bg-blue-100 text-blue-700',
    in_development: 'bg-blue-100 text-blue-700',
    draft: 'bg-gray-100 text-gray-600',
    not_started: 'bg-gray-100 text-gray-500',
    in_review: 'bg-purple-100 text-purple-700',
    delivered: 'bg-teal-100 text-teal-700',
    adjustments_requested: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-gray-100 text-gray-600',
  };
  const label = ROLE_STATUS_LABELS[status] ?? status;
  const cls = COLORS[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function buildFlowSteps(act: WorkspaceActivity): FlowStep[] {
  const roles = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'] as const;
  const currentRoleIdx = roles.indexOf(act.role as typeof roles[number]);
  return roles.map((r, idx) => {
    const completed = idx < currentRoleIdx || (r === act.role && act.status === 'approved');
    const active = r === act.role && !completed;
    return {
      role: r,
      label: ROLE_LABELS[r],
      status: r === act.role ? (ROLE_STATUS_LABELS[act.status] ?? act.status) : (completed ? 'Aprobado' : 'Pendiente'),
      completed,
      active,
    };
  });
}

function matchesFilter(act: WorkspaceActivity, filter: StatFilter): boolean {
  if (!filter) return true;
  if (filter === 'overdue') return act.date_status === 'overdue' && act.status !== 'approved';
  if (filter === 'approved') return act.status === 'approved';
  if (filter === 'pending') return act.status === 'not_started' || act.status === 'pending';
  if (filter === 'in_process') return act.status === 'in_progress' || act.status === 'in_development' || act.status === 'draft';
  if (filter === 'in_review') return act.status === 'in_review' || act.status === 'delivered';
  if (filter === 'returned') return act.status === 'adjustments_requested' || act.status === 'adjusting';
  return true;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-emerald-700 text-white rounded-xl shadow-xl px-5 py-3 text-sm leading-snug animate-fade-in">
      {message}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardOperativo() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatFilter>(null);
  const [selectedAct, setSelectedAct] = useState<WorkspaceActivity | null>(null);
  const [panelTab, setPanelTab] = useState<'info' | 'flow' | 'comments'>('info');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [localActivities, setLocalActivities] = useState<WorkspaceActivity[]>([]);

  useEffect(() => {
    api
      .get<Workspace>(ENDPOINTS.MY_WORKSPACE)
      .then((ws) => { setWorkspace(ws); setLocalActivities(ws.activities ?? []); })
      .catch(() => { setWorkspace(MOCK_WORKSPACE); setLocalActivities(MOCK_WORKSPACE.activities ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const data = workspace ?? MOCK_WORKSPACE;

  // Compute stats from local activities
  const stats = {
    pending: localActivities.filter((a) => a.status === 'not_started' || a.status === 'pending').length,
    in_process: localActivities.filter((a) => ['in_progress', 'in_development', 'draft'].includes(a.status)).length,
    in_review: localActivities.filter((a) => ['in_review', 'delivered'].includes(a.status)).length,
    returned: localActivities.filter((a) => ['adjustments_requested', 'adjusting'].includes(a.status)).length,
    approved: localActivities.filter((a) => a.status === 'approved').length,
    overdue: localActivities.filter((a) => a.date_status === 'overdue' && a.status !== 'approved').length,
  };

  const statCards = [
    { key: 'pending' as StatFilter, label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', ring: 'ring-gray-300' },
    { key: 'in_process' as StatFilter, label: 'En Proceso', value: stats.in_process, icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-300' },
    { key: 'in_review' as StatFilter, label: 'En Revisión', value: stats.in_review, icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50', ring: 'ring-purple-300' },
    { key: 'returned' as StatFilter, label: 'Devueltas', value: stats.returned, icon: RotateCcw, color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-300' },
    { key: 'approved' as StatFilter, label: 'Aprobadas', value: stats.approved, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', ring: 'ring-green-300' },
    { key: 'overdue' as StatFilter, label: 'Vencidas', value: stats.overdue, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-300' },
  ];

  // Table: non-approved only, filtered
  const sorted = [...localActivities]
    .filter((a) => a.status !== 'approved')
    .filter((a) => matchesFilter(a, activeFilter === 'approved' ? null : activeFilter))
    .sort((a, b) => {
      const ORDER: Record<string, number> = { overdue: 0, approaching: 1, on_time: 2, completed: 3, not_applicable: 4 };
      const diff = (ORDER[a.date_status] ?? 9) - (ORDER[b.date_status] ?? 9);
      if (diff !== 0) return diff;
      return (a.commitment_date ?? '').localeCompare(b.commitment_date ?? '');
    });

  // Quick action handler
  const handleQuickAction = useCallback(async (act: WorkspaceActivity, action: string) => {
    setActionLoading(act.id);
    let newStatus = act.status;
    try {
      await api.post<void>(ENDPOINTS.ACTIVITY_QUICK_ACTION(act.id), { action });
    } catch {
      // optimistic
    }
    // Map action to status
    if (action === 'deliver') newStatus = 'delivered';
    else if (action === 'approve') newStatus = 'approved';
    else if (action === 'request_adjustments') newStatus = 'adjustments_requested';

    setLocalActivities((prev) =>
      prev.map((a) => a.id === act.id ? { ...a, status: newStatus } : a)
    );

    if (action === 'deliver') {
      const nextName = act.next_responsible ?? 'Siguiente responsable';
      const nextRoleLabel = act.next_role ? (ROLE_LABELS[act.next_role] ?? act.next_role) : '';
      const nextDate = act.next_date ? formatDate(act.next_date) : '';
      setToastMsg(`✓ Actividad entregada. Próximo: ${nextName}${nextRoleLabel ? ` (${nextRoleLabel})` : ''}${nextDate ? ` — límite ${nextDate}` : ''}`);
    }
    setActionLoading(null);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  const flowSteps = selectedAct ? buildFlowSteps(selectedAct) : [];
  const userRoleLabel = (USER_ROLE_LABELS as Record<string, string>)[data.role] ?? data.role;

  return (
    <div className="p-6 space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Espacio de Trabajo</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {data.user.name} · {userRoleLabel}
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="ml-3 text-indigo-600 hover:underline text-xs"
            >
              Limpiar filtro
            </button>
          )}
        </p>
      </div>

      {/* Stat cards — 2 rows × 3 cols */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(({ key, label, value, icon: Icon, color, bg, ring }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(activeFilter === key ? null : key)}
            className={`bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 text-left hover:shadow-md transition-all ${
              activeFilter === key ? `ring-2 ${ring}` : ''
            }`}
          >
            <div className={`${bg} rounded-lg p-2.5 flex-shrink-0`}>
              <Icon className={`${color} w-5 h-5`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Activities table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            Mis Actividades Pendientes
            {activeFilter && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                — filtrando por {statCards.find((s) => s.key === activeFilter)?.label}
              </span>
            )}
          </h2>
          <span className="text-xs text-gray-400">{sorted.length} actividad(es)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prioridad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Programa / Asignatura</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entregable</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha Límite</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sig. Responsable</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((act) => {
                const daysLeft = act.commitment_date ? daysDiff(act.commitment_date) : null;
                const isLoading = actionLoading === act.id;

                return (
                  <tr key={act.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    {/* Priority */}
                    <td className="px-4 py-3">{getPriorityBadge(act)}</td>

                    {/* Program + Subject */}
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-gray-800 text-xs font-medium truncate" title={act.program.name}>
                        {act.program.name}
                      </p>
                      <p className="text-gray-400 text-[11px] truncate" title={act.subject.name}>
                        {act.subject.name}
                      </p>
                    </td>

                    {/* Deliverable + type badge */}
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="font-medium text-gray-900 truncate text-xs" title={act.deliverable.name}>
                        {act.deliverable.name}
                      </p>
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 mt-0.5 inline-block bg-indigo-50 text-indigo-600 font-medium">
                        {DELIVERABLE_TYPE_LABELS[act.deliverable.type]}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">{getStatusBadge(act.status)}</td>

                    {/* Due date */}
                    <td className="px-4 py-3 text-xs text-gray-700 min-w-[130px]">
                      {act.commitment_date ? (
                        <>
                          <p>{formatDate(act.commitment_date)}</p>
                          {daysLeft !== null && (
                            <p className={daysLeft < 0 ? 'text-red-500 font-medium' : 'text-gray-400'}>
                              {daysLeft < 0
                                ? `Vencida hace ${Math.abs(daysLeft)} día(s)`
                                : daysLeft === 0
                                ? 'Vence hoy'
                                : `Vence en ${daysLeft} día(s)`}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Next responsible */}
                    <td className="px-4 py-3 min-w-[160px]">
                      {act.next_responsible ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {act.next_responsible.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-800 font-medium truncate">{act.next_responsible}</p>
                            {act.next_role && (
                              <p className="text-[10px] text-gray-400">{ROLE_LABELS[act.next_role]}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Quick actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Deliver */}
                        {['not_started', 'in_progress', 'in_development', 'draft', 'pending'].includes(act.status) && (
                          <button
                            onClick={() => handleQuickAction(act, 'deliver')}
                            disabled={isLoading}
                            title="Entregar"
                            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-50"
                          >
                            <Send size={11} /> Entregar
                          </button>
                        )}
                        {/* Approve (reviewer) */}
                        {['delivered', 'in_review'].includes(act.status) && (
                          <button
                            onClick={() => handleQuickAction(act, 'approve')}
                            disabled={isLoading}
                            title="Aprobar"
                            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          >
                            <ThumbsUp size={11} /> Aprobar
                          </button>
                        )}
                        {/* Request adjustments */}
                        {['delivered', 'in_review', 'in_progress', 'in_development'].includes(act.status) && (
                          <button
                            onClick={() => handleQuickAction(act, 'request_adjustments')}
                            disabled={isLoading}
                            title="Solicitar Ajustes"
                            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            <MessageSquareWarning size={11} /> Ajustes
                          </button>
                        )}
                        {/* Detail */}
                        <button
                          onClick={() => { setSelectedAct(act); setPanelTab('info'); }}
                          title="Ver Detalle"
                          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          <Eye size={11} /> Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    {activeFilter === 'approved'
                      ? 'Las actividades aprobadas no se muestran en esta tabla.'
                      : 'No hay actividades pendientes con el filtro seleccionado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel — activity detail */}
      <SidePanel
        open={!!selectedAct}
        onClose={() => setSelectedAct(null)}
        title={selectedAct ? selectedAct.deliverable.name : ''}
        width="lg"
      >
        {selectedAct && (
          <div className="flex flex-col h-full">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 px-4 pt-2">
              {(['info', 'flow', 'comments'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPanelTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    panelTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'info' ? 'Info' : tab === 'flow' ? 'Flujo' : 'Comentarios'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Info tab */}
              {panelTab === 'info' && (
                <div className="p-5 space-y-5">
                  {/* Deliverable info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Programa</p>
                      <p className="text-sm font-medium text-gray-800">{selectedAct.program.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Asignatura</p>
                      <p className="text-sm text-gray-700">{selectedAct.subject.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Entregable</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedAct.deliverable.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Tipo</p>
                      <p className="text-sm text-gray-700">{DELIVERABLE_TYPE_LABELS[selectedAct.deliverable.type]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Estado actual</p>
                      {getStatusBadge(selectedAct.status)}
                    </div>
                    {selectedAct.commitment_date && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Fecha límite</p>
                        <p className="text-sm text-gray-700">{formatDate(selectedAct.commitment_date)}</p>
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex gap-2 pt-1 flex-wrap">
                    {['not_started', 'in_progress', 'in_development', 'draft', 'pending'].includes(selectedAct.status) && (
                      <button
                        onClick={() => handleQuickAction(selectedAct, 'deliver')}
                        disabled={actionLoading === selectedAct.id}
                        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                      >
                        <Send size={14} /> Entregar
                      </button>
                    )}
                    {['delivered', 'in_review'].includes(selectedAct.status) && (
                      <button
                        onClick={() => handleQuickAction(selectedAct, 'approve')}
                        disabled={actionLoading === selectedAct.id}
                        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        <ThumbsUp size={14} /> Aprobar
                      </button>
                    )}
                  </div>

                  {/* Next responsible */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Próximo responsable</p>
                    <NextResponsibleCard
                      nextRole={selectedAct.next_role}
                      nextResponsible={selectedAct.next_responsible}
                      nextDate={selectedAct.next_date}
                    />
                  </div>
                </div>
              )}

              {/* Flow tab */}
              {panelTab === 'flow' && (
                <div className="p-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Flujo de Producción</p>
                  <DeliverableFlow steps={flowSteps} />
                  <div className="mt-6">
                    <NextResponsibleCard
                      nextRole={selectedAct.next_role}
                      nextResponsible={selectedAct.next_responsible}
                      nextDate={selectedAct.next_date}
                    />
                  </div>
                </div>
              )}

              {/* Comments tab */}
              {panelTab === 'comments' && (
                <div className="flex flex-col h-full">
                  <CommentThread
                    deliverableId={selectedAct.deliverable.id}
                    deliverableName={selectedAct.deliverable.name}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </SidePanel>

      {/* Toast */}
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />}
    </div>
  );
}
