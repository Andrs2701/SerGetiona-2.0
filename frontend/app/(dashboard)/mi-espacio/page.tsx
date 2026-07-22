'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, X, ChevronDown, ChevronUp, ChevronRight,
  Clock, XCircle, CheckCircle2, AlertTriangle, Shield,
  CalendarDays, Link2, MessageSquare, GitCommitHorizontal,
  Send, Plus, Trash2, ExternalLink, Filter, Package,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { Workspace, WorkspaceActivity, EvidenceLink, ResourceType, ProductionLog, DeliverableFlow, DecisionRecord, DecisionStatus, RoleStatus } from '@/lib/types';
import { ROLE_LABELS, ROLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS, DECISION_STATUS_LABELS, DECISION_IMPACT_LABELS } from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';
import { HIDDEN_IN_WORKSPACE_STATUSES, NOT_OVERDUE_STATUSES } from '@/lib/statusGroups';
import { AlertCircle } from 'lucide-react';
import ActivityDetailPanel from '@/components/ActivityDetailPanel';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function daysDiff(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(date + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}

function computeAutoStatus(act: WorkspaceActivity): { label: string; cls: string } {
  // Va primero: "No Aplica" cierra la actividad, así que no debe caer al
  // "Pendiente" del final ni pintarse como vencida.
  if (act.status === 'not_applicable')
    return { label: 'No Aplica', cls: 'bg-gray-100 text-gray-500' };
  if (act.status === 'approved') {
    if (act.actual_delivery_date && act.commitment_date)
      return act.actual_delivery_date <= act.commitment_date
        ? { label: 'Entregada a tiempo',       cls: 'bg-emerald-100 text-emerald-700' }
        : { label: 'Entregada fuera de tiempo', cls: 'bg-amber-100  text-amber-700'  };
    return { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700' };
  }
  if (act.status === 'delivered')
                                      return { label: 'Entregado',   cls: 'bg-teal-100   text-teal-700'   };
  if (act.date_status === 'overdue') return { label: 'Vencida',     cls: 'bg-red-100    text-red-700'    };
  if (['adjustments_requested', 'with_findings'].includes(act.status))
                                      return { label: 'Devuelta',    cls: 'bg-orange-100 text-orange-700' };
  if (act.status === 'in_progress')
                                      return { label: 'En Progreso',  cls: 'bg-blue-100   text-blue-700'   };
  return { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' };
}

const DATE_STATUS_SORT: Record<string, number> = {
  overdue: 0, approaching: 1, on_time: 2, completed: 3, not_applicable: 4,
};

// Statuses that only admin/coordinator can set (backend enforces this too)
const MANAGER_ONLY_STATUSES = ['approved'];

// ─── Detail Panel tabs ────────────────────────────────────────────────────────

type PanelTab = 'principal' | 'evidencias' | 'comentarios' | 'timeline';

const PRODUCTION_ROLES = new Set(['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']);

// TimelineView se movió a '@/components/ActivityDetailPanel'
// DeliverableTimelineView se movió a '@/components/DeliverableTimelineView'
// EvidenceLinksPanel movido a '@/components/ActivityDetailPanel'

// Evidencias tab — full flow per role
function EvidenciasTab({ deliverableId }: { deliverableId: number }) {
  const [flow, setFlow] = useState<DeliverableFlow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DeliverableFlow>(ENDPOINTS.DELIVERABLE_FLOW(deliverableId))
      .then(setFlow)
      .catch(() => setFlow(null))
      .finally(() => setLoading(false));
  }, [deliverableId]);

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700/40 rounded-lg animate-pulse"/>)}</div>;
  if (!flow) return <p className="text-sm text-gray-400 py-4 text-center">No hay información disponible</p>;

  const ROLE_LABELS_LOCAL: Record<string, string> = {
    expert: 'Experto', pedagogy: 'Pedagogía', design: 'Diseño',
    audiovisual: 'Audiovisual', engineering: 'Ingeniería', qa: 'QA',
  };
  const STATUS_COLORS: Record<string, string> = {
    delivered: 'bg-teal-100 text-teal-700', approved: 'bg-emerald-100 text-emerald-700',
    not_started: 'bg-gray-100 text-gray-500', in_progress: 'bg-blue-100 text-blue-700',
    in_development: 'bg-blue-100 text-blue-700', draft: 'bg-blue-100 text-blue-700',
    adjustments_requested: 'bg-orange-100 text-orange-700',
    with_findings: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-4">
      {flow.roles.map(r => {
        const hasContent = r.production.length > 0 || r.links.length > 0 || r.notes;
        if (!hasContent && r.status === 'not_started') return null;
        const statusColor = STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-500';
        return (
          <div key={r.role} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            {/* Role header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {ROLE_LABELS_LOCAL[r.role] ?? r.role}
                </span>
                {r.responsible && <span className="text-[10px] text-gray-400">— {r.responsible.name}</span>}
              </div>
              <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full', statusColor)}>
                {ROLE_STATUS_LABELS[r.status] ?? r.status}
              </span>
            </div>

            {/* Content */}
            <div className="px-3 py-2.5 space-y-2.5">
              {/* Production resources */}
              {r.production.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Recursos producidos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.production.map(p => (
                      <span key={p.resource_type} className="inline-flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                        {p.resource_type} <span className="font-bold">({p.total})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence links */}
              {r.links.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Evidencias</p>
                  {r.links.map(l => (
                    <div key={l.id} className="flex items-center gap-2 text-xs py-1">
                      <Link2 size={11} className="text-indigo-400 flex-shrink-0"/>
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-indigo-600 dark:text-indigo-400 hover:underline truncate">{l.title}</a>
                      ) : (
                        <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{l.title}</span>
                      )}
                      {l.user && <span className="text-[10px] text-gray-400 flex-shrink-0">{l.user.name}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {r.notes && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Observaciones</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{r.notes}</p>
                </div>
              )}

              {!r.production.length && !r.links.length && !r.notes && (
                <p className="text-xs text-gray-400 py-1">Sin registros para este rol</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Comments
interface CommentItem { user: { name: string }; content: string; created_at: string }

function CommentsPanel({ deliverableId }: { deliverableId: number }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get<CommentItem[]>(ENDPOINTS.DELIVERABLE_COMMENTS(deliverableId))
      .then(r => setComments(Array.isArray(r) ? r : []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [deliverableId]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const c = await api.post<CommentItem>(`/deliverables/${deliverableId}/comments`, { content: text.trim() });
      setComments(p => [...p, c as CommentItem]);
      setText('');
    } catch { /* ignore */ }
    setSending(false);
  }

  if (loading) return <div className="h-16 bg-gray-50 rounded animate-pulse"/>;

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-52 overflow-y-auto">
        {!comments.length && <p className="text-xs text-gray-400">Sin comentarios aún</p>}
        {comments.map((c, i) => (
          <div key={i} className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{c.user?.name?.[0] ?? '?'}</div>
            <div className="flex-1 bg-gray-50 rounded-lg p-2">
              <p className="text-xs font-medium text-gray-800">{c.user?.name}</p>
              <p className="text-xs text-gray-600 mt-0.5">{c.content}</p>
              <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(c.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Agregar comentario..."
          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 placeholder:text-gray-400"/>
        <button onClick={handleSend} disabled={sending || !text.trim()}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Send size={12}/>
        </button>
      </div>
    </div>
  );
}

// QuickProductionGrid movido a '@/components/ActivityDetailPanel'

// DetailPanel movido a '@/components/ActivityDetailPanel'

// ─── Table row ────────────────────────────────────────────────────────────────

function ActivityRow({
  act,
  onSelect,
  selected,
  highlighted,
}: {
  act: WorkspaceActivity;
  onSelect: (a: WorkspaceActivity) => void;
  selected: boolean;
  highlighted?: boolean;
}) {
  const autoStatus = computeAutoStatus(act);
  const daysLeft = act.commitment_date ? daysDiff(act.commitment_date) : null;

  const rowBg = selected
    ? 'bg-indigo-50 dark:bg-indigo-900/20'
    : highlighted
    ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400 dark:bg-indigo-900/25 dark:ring-indigo-500'
    : act.date_status === 'overdue'
    ? 'bg-red-50/40 hover:bg-red-50/60 dark:bg-red-900/20 dark:hover:bg-red-900/30'
    : act.date_status === 'approaching'
    ? 'bg-amber-50/40 hover:bg-amber-50/60 dark:bg-amber-900/15 dark:hover:bg-amber-900/25'
    : 'hover:bg-gray-50/70 dark:hover:bg-white/[0.04]';

  return (
    <tr
      id={`activity-row-${act.id}`}
      onClick={() => onSelect(act)}
      className={clsx('border-b border-gray-100 cursor-pointer transition-colors text-sm', rowBg)}
    >
      {/* Indicador de prioridad (barra color) */}
      <td className="w-1 p-0">
        <div className={clsx('w-1 h-full min-h-[36px]',
          act.date_status === 'overdue'    ? 'bg-red-400'    :
          act.date_status === 'approaching'? 'bg-amber-400'  :
          act.status === 'approved'        ? 'bg-emerald-400' : 'bg-gray-200'
        )}/>
      </td>

      {/* Semana / Módulo */}
      <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[160px]">
        <div className="flex items-center gap-2">
          <span className="truncate" title={act.deliverable?.name ?? '—'}>{act.deliverable?.name ?? '—'}</span>
          <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block',
            act.priority === 'alta' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
            act.priority === 'baja' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
          )} title={`Prioridad: ${act.priority ?? 'media'}`}/>
        </div>
        {act.deliverable && <p className="text-[10px] text-indigo-500 mt-0.5">{DELIVERABLE_TYPE_LABELS[act.deliverable.type]}</p>}
      </td>

      {/* Asignatura */}
      <td className="px-3 py-2.5 text-gray-600 max-w-[140px]">
        <p className="truncate text-xs" title={act.subject?.name ?? '—'}>{act.subject?.name ?? '—'}</p>
      </td>

      {/* Estado */}
      <td className="px-3 py-2.5">
        <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', autoStatus.cls)}>
          {autoStatus.label}
        </span>
      </td>

      {/* Fecha límite */}
      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
        {act.commitment_date ? (
          <div>
            <p className="text-gray-700">{formatDate(act.commitment_date)}</p>
            {daysLeft !== null && (
              <p className={clsx('text-[10px] mt-0.5',
                daysLeft < 0  ? 'text-red-500 font-semibold' :
                daysLeft === 0? 'text-amber-600 font-semibold' :
                daysLeft <= 5 ? 'text-amber-500' : 'text-gray-400')}>
                {daysLeft < 0  ? `Vencida hace ${Math.abs(daysLeft)}d` :
                 daysLeft === 0 ? 'Vence hoy' : `${daysLeft}d restantes`}
              </p>
            )}
          </div>
        ) : <span className="text-gray-400">—</span>}
      </td>

      {/* Flecha detalle */}
      <td className="px-3 py-2.5 text-gray-300">
        <ChevronRight size={14}/>
      </td>
    </tr>
  );
}

// ─── Program group ────────────────────────────────────────────────────────────

function ProgramGroup({
  programName,
  activities,
  onSelect,
  selectedId,
  defaultOpen = true,
  highlightId,
}: {
  programName: string;
  activities: WorkspaceActivity[];
  onSelect: (a: WorkspaceActivity) => void;
  selectedId: number | null;
  defaultOpen?: boolean;
  highlightId?: number | null;
}) {
  const containsHighlight = highlightId ? activities.some(a => a.id === highlightId) : false;
  const [open, setOpen] = useState(defaultOpen || containsHighlight);

  const overdue   = activities.filter(a => a.date_status === 'overdue' && a.status !== 'approved').length;
  const approved  = activities.filter(a => a.status === 'approved').length;
  const pct       = activities.length > 0 ? Math.round((approved / activities.length) * 100) : 0;

  return (
    <tbody>
      {/* Group header row */}
      <tr
        onClick={() => setOpen(o => !o)}
        className="bg-gray-50 border-y border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors select-none"
      >
        <td colSpan={6} className="px-4 py-2.5">
          <div className="flex items-center gap-3">
            {open ? <ChevronDown size={14} className="text-gray-500 flex-shrink-0"/> : <ChevronRight size={14} className="text-gray-500 flex-shrink-0"/>}
            <span className="text-sm font-semibold text-gray-800 truncate flex-1">{programName}</span>
            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
              <span>{activities.length} actividades</span>
              {overdue > 0 && (
                <span className="flex items-center gap-1 text-red-600 font-semibold">
                  <XCircle size={11}/> {overdue} vencidas
                </span>
              )}
              {/* Mini progress */}
              <div className="flex items-center gap-1.5">
                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                  <div
                    className={clsx('h-1.5 rounded-full', pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-medium text-gray-600">{pct}%</span>
              </div>
            </div>
          </div>
        </td>
      </tr>
      {/* Activity rows */}
      {open && activities.map(act => (
        <ActivityRow key={act.id} act={act} onSelect={onSelect} selected={selectedId === act.id} highlighted={highlightId === act.id}/>
      ))}
    </tbody>
  );
}

// ─── Decisiones asignadas a mí ────────────────────────────────────────────────

function DecisionMiniCard({ decision, onStatusChange, onViewDetails }: { decision: DecisionRecord; onStatusChange: (id: number, status: DecisionStatus) => void; onViewDetails: (d: DecisionRecord) => void }) {
  const overdue = !!decision.due_date
    && decision.status !== 'implemented' && decision.status !== 'cancelled'
    && daysDiff(decision.due_date.slice(0, 10)) < 0;

  const impactCls = decision.impact === 'high'
    ? 'bg-red-100 text-red-700'
    : decision.impact === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className="p-4 space-y-2 hover:bg-violet-100/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide animate-pulse">
                ⚠️ Vencida
              </span>
            )}
          </div>
          <p 
            onClick={() => onViewDetails(decision)}
            className="text-sm font-medium text-gray-900 leading-snug cursor-pointer hover:text-indigo-600 transition-colors mt-1 line-clamp-2"
            title="Haz clic para ver todos los detalles"
          >
            {decision.description}
          </p>
        </div>
        <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0', impactCls)}>
          {DECISION_IMPACT_LABELS[decision.impact]}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500">
        {[decision.project?.name, decision.program?.name].filter(Boolean).join(' · ') || null}
        {decision.creator?.name && (
          <span>
            · Creada por <strong className="text-gray-600">{decision.creator.name}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
        <div className="flex items-center gap-3">
          {decision.due_date && (
            <span className={clsx('inline-flex items-center gap-1 text-xs font-medium', overdue ? 'text-red-600' : 'text-gray-500')}>
              <CalendarDays size={12} />
              {overdue ? 'Vencida: ' : 'Vence: '}{formatDate(decision.due_date.slice(0, 10))}
            </span>
          )}
          <button 
            onClick={() => onViewDetails(decision)}
            className="text-[11px] text-violet-700 hover:text-violet-900 font-semibold hover:underline"
          >
            Ver detalles
          </button>
        </div>

        <select
          value={decision.status}
          onChange={(e) => onStatusChange(decision.id, e.target.value as DecisionStatus)}
          className="text-xs border border-violet-200 text-violet-700 bg-white rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
        >
          {(['pending', 'in_progress', 'implemented', 'cancelled'] as DecisionStatus[]).map((s) => (
            <option key={s} value={s}>{DECISION_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type StatusFilter = '' | 'pending' | 'overdue' | 'approaching' | 'in_process' | 'completed';

export default function MiEspacioPage() {
  const { user } = useAuthContext();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [selectedAct, setSelectedAct] = useState<WorkspaceActivity | null>(null);
  const searchParams = useSearchParams();
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Filters
  const [search, setSearch]               = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus]   = useState<StatusFilter>('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showFinishedDecisions, setShowFinishedDecisions] = useState(false);
  const [viewingDecisionDetail, setViewingDecisionDetail] = useState<DecisionRecord | null>(null);

  const loadWorkspace = useCallback(() => {
    api.get<Workspace>(ENDPOINTS.MY_WORKSPACE)
      .then(ws => {
        setWorkspace(ws);
        const fresh = ws.activities ?? [];
        setActivities(fresh);
        // Keep selected panel in sync with fresh data
        setSelectedAct(prev => prev ? (fresh.find(a => a.id === prev.id) ?? null) : null);
      })
      .catch(() => { setWorkspace(null); setActivities([]); })
      .finally(() => setLoading(false));
  }, []);

  // Initial load + poll every 60 s so all users see current statuses
  useEffect(() => {
    loadWorkspace();
    const iv = setInterval(loadWorkspace, 60_000);
    return () => clearInterval(iv);
  }, [loadWorkspace]);

  useEffect(() => {
    // ?open=ID also supported: both ?highlight= and ?open= set highlightId and open the panel
    const highlight = searchParams.get('highlight');
    const open = searchParams.get('open');
    const rawId = open ?? highlight;
    if (rawId) {
      const numId = parseInt(rawId, 10);
      if (!isNaN(numId)) setHighlightId(numId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!highlightId || activities.length === 0) return;
    // Search ALL activities so completed/filtered-out ones are still found
    const act = activities.find(a => a.id === highlightId);
    if (act) {
      // Auto-open the detail panel for the linked activity
      setSelectedAct(act);
      setTimeout(() => {
        const el = document.getElementById(`activity-row-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    }
  }, [highlightId, activities]);

  // Optimistic local update + schedule a server sync
  const handleStatusChange = useCallback((id: number, status: string) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setSelectedAct(prev => prev?.id === id ? { ...prev, status } : prev);
  }, []);

  const handleDecisionStatusChange = useCallback(async (id: number, status: DecisionStatus) => {
    setWorkspace(prev => prev
      ? { ...prev, decisions: (prev.decisions ?? []).map(d => d.id === id ? { ...d, status } : d) }
      : prev);
    try {
      await api.put(ENDPOINTS.DECISION_STATUS(id), { status });
    } catch {
      loadWorkspace();
    }
  }, [loadWorkspace]);

  // Derived lists for filter dropdowns
  const programOptions = useMemo(
    () => [...new Set(activities.map(a => a.program?.name).filter((n): n is string => !!n))].sort(),
    [activities]
  );

  const subjectOptions = useMemo(() => {
    const source = filterProgram
      ? activities.filter(a => a.program?.name === filterProgram)
      : activities;
    return [...new Set(source.map(a => a.subject?.name).filter((n): n is string => !!n))].sort();
  }, [activities, filterProgram]);

  // When program changes reset subject
  const handleProgramChange = (v: string) => {
    setFilterProgram(v);
    setFilterSubject('');
  };

  // KPIs
  const total     = activities.length;
  const pending   = activities.filter(a => ['not_started','pending'].includes(a.status)).length;
  const overdue   = activities.filter(a => a.date_status === 'overdue' && !NOT_OVERDUE_STATUSES.includes(a.status)).length;
  const approaching = activities.filter(a => a.date_status === 'approaching' && !NOT_OVERDUE_STATUSES.includes(a.status)).length;
  const completed = activities.filter(a => a.status === 'approved').length;

  const completedHiddenCount = useMemo(
    () => !showCompleted && filterStatus !== 'completed'
      ? activities.filter(a => HIDDEN_IN_WORKSPACE_STATUSES.includes(a.status)).length
      : 0,
    [activities, showCompleted, filterStatus]
  );

  // Filter activities
  const filtered = useMemo(() => activities
    .filter(a => {
      // Hide approved, delivered, in_review or not_applicable unless user toggled showCompleted or explicitly filtered for completed
      if (!showCompleted && filterStatus !== 'completed' && HIDDEN_IN_WORKSPACE_STATUSES.includes(a.status)) return false;
      if (search && ![a.deliverable?.name ?? '', a.subject?.name ?? '', a.program?.name ?? ''].some(s => s.toLowerCase().includes(search.toLowerCase()))) return false;
      if (filterProgram && (a.program?.name ?? '') !== filterProgram) return false;
      if (filterSubject && (a.subject?.name ?? '') !== filterSubject) return false;
      if (filterStatus === 'pending')    return ['not_started','pending'].includes(a.status);
      if (filterStatus === 'overdue')    return a.date_status === 'overdue';
      if (filterStatus === 'approaching')return a.date_status === 'approaching';
      if (filterStatus === 'in_process') return a.status === 'in_progress';
      if (filterStatus === 'completed')  return HIDDEN_IN_WORKSPACE_STATUSES.includes(a.status);
      return true;
    })
    .sort((a, b) => {
      const ds = (DATE_STATUS_SORT[a.date_status] ?? 9) - (DATE_STATUS_SORT[b.date_status] ?? 9);
      if (ds !== 0) return ds;
      if ((a.program?.name ?? '') !== (b.program?.name ?? '')) return (a.program?.name ?? '').localeCompare(b.program?.name ?? '');
      if ((a.subject?.name ?? '') !== (b.subject?.name ?? '')) return (a.subject?.name ?? '').localeCompare(b.subject?.name ?? '');
      return (a.commitment_date ?? '').localeCompare(b.commitment_date ?? '');
    }),
  [activities, search, filterProgram, filterSubject, filterStatus, showCompleted]);

  // Group by program — active programs first, completed programs last and auto-collapsed
  const grouped = useMemo(() => {
    const map = new Map<string, WorkspaceActivity[]>();
    for (const act of filtered) {
      const progName = act.program?.name ?? '(Sin programa)';
      const g = map.get(progName) ?? [];
      g.push(act);
      map.set(progName, g);
    }
    return new Map(
      [...map.entries()].sort(([nameA, actsA], [nameB, actsB]) => {
        const aActive = actsA.some(a => a.status !== 'approved');
        const bActive = actsB.some(a => a.status !== 'approved');
        if (aActive !== bActive) return aActive ? -1 : 1;
        return nameA.localeCompare(nameB);
      })
    );
  }, [filtered]);

  const hasFilters = search || filterProgram || filterSubject || filterStatus;

  const roleLabel = user ? (ROLE_LABELS as Record<string, string>)[user.role] ?? user.role : '';

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"/>
        <div className="h-10 bg-gray-100 rounded animate-pulse"/>
        <div className="space-y-1">{[...Array(6)].map((_,i) => <div key={i} className="h-10 bg-white border border-gray-100 rounded animate-pulse"/>)}</div>
      </div>
    );
  }

  return (
    <>
      {selectedAct && selectedAct.deliverable && (
        <ActivityDetailPanel
          activity={selectedAct}
          deliverable={selectedAct.deliverable}
          onClose={() => setSelectedAct(null)}
          onStatusChange={handleStatusChange}
          isManager={isManager}
          onSaved={loadWorkspace}
        />
      )}

      <div className="p-4 sm:p-6 space-y-5">
        {/* Heading */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Espacio de Trabajo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {roleLabel} · {total} actividades asignadas
            {user?.covering_roles && user.covering_roles.length > 0 && (
              <span className="text-indigo-500"> · Cubriendo {user.covering_roles.map(r => (ROLE_LABELS as Record<string, string>)[r] ?? r).join(', ')}</span>
            )}
          </p>
        </div>

        {/* Decisiones asignadas a mí — solo roles no admin/coordinador */}
        {!isManager && !!workspace?.decisions?.length && (() => {
          const totalDecisions = workspace.decisions;
          const activeDecisions = totalDecisions.filter(d => d.status === 'pending' || d.status === 'in_progress');
          const finishedDecisions = totalDecisions.filter(d => d.status === 'implemented' || d.status === 'cancelled');
          const visibleDecisions = showFinishedDecisions ? totalDecisions : activeDecisions;

          return (
            <div className="bg-violet-50 border border-violet-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-violet-100 bg-violet-100/50 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Shield size={15} className="text-violet-600" />
                  <h3 className="font-semibold text-violet-900 text-sm">
                    Decisiones asignadas a mí ({activeDecisions.length} activas / {totalDecisions.length} total)
                  </h3>
                </div>
                {finishedDecisions.length > 0 && (
                  <button
                    onClick={() => setShowFinishedDecisions(prev => !prev)}
                    className="text-xs text-violet-700 hover:text-violet-900 hover:underline font-semibold transition-colors"
                  >
                    {showFinishedDecisions ? 'Ocultar finalizadas' : `Ver finalizadas (${finishedDecisions.length})`}
                  </button>
                )}
              </div>
              <div className="divide-y divide-violet-100">
                {visibleDecisions.length > 0 ? (
                  visibleDecisions.map(d => (
                    <DecisionMiniCard key={d.id} decision={d} onStatusChange={handleDecisionStatusChange} onViewDetails={setViewingDecisionDetail} />
                  ))
                ) : (
                  <p className="text-xs text-violet-600 py-4 px-4 text-center font-medium italic">
                    No tienes decisiones activas pendientes de implementar.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* KPI pills + completed toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: '' as StatusFilter,          label: 'Activas',     count: total - completed, icon: null,         cls: '' },
            { id: 'pending' as StatusFilter,    label: 'Pendientes',  count: pending,    icon: Clock,        cls: 'text-gray-600' },
            { id: 'overdue' as StatusFilter,    label: 'Vencidas',    count: overdue,    icon: XCircle,      cls: 'text-red-600' },
            { id: 'approaching' as StatusFilter,label: 'Por vencer',  count: approaching,icon: AlertTriangle,cls: 'text-amber-600' },
            { id: 'in_process' as StatusFilter, label: 'En proceso',  count: activities.filter(a => a.status === 'in_progress').length, icon: null, cls: 'text-blue-600' },
            { id: 'completed' as StatusFilter,  label: 'Completadas', count: completed,  icon: CheckCircle2, cls: 'text-emerald-600' },
          ] as { id: StatusFilter; label: string; count: number; icon: React.ElementType | null; cls: string }[]).map(({ id, label, count, icon: Icon, cls }) => (
            <button key={id} onClick={() => setFilterStatus(id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                filterStatus === id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
              )}>
              {Icon && <Icon size={12} className={filterStatus === id ? '' : cls}/>}
              {label}
              <span className={clsx('ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                filterStatus === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
                {count}
              </span>
            </button>
          ))}

          {/* Completed toggle */}
          <button
            onClick={() => setShowCompleted(p => !p)}
            className={clsx(
              'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              showCompleted
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 bg-white'
            )}
          >
            <CheckCircle2 size={12} className={showCompleted ? 'text-emerald-500' : 'text-gray-300'} />
            {showCompleted ? 'Ocultar completadas' : 'Ver completadas'}
            {!showCompleted && completedHiddenCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
                {completedHiddenCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
          <Filter size={14} className="text-gray-400 flex-shrink-0"/>

          {/* Program */}
          <select value={filterProgram} onChange={e => handleProgramChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 bg-white min-w-[180px]">
            <option value="">Todos los programas</option>
            {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Subject — depends on program */}
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 bg-white min-w-[160px]">
            <option value="">Todas las asignaturas</option>
            {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar entregable..."
              className="pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 placeholder:text-gray-400"/>
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12}/></button>}
          </div>

          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterProgram(''); setFilterSubject(''); setFilterStatus(''); }}
              className="text-xs text-indigo-500 hover:text-indigo-700 underline flex-shrink-0">
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {grouped.size === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No hay actividades con los filtros aplicados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-1 p-0"/>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Semana / Módulo</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Asignatura</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha límite</th>
                    <th className="w-8"/>
                  </tr>
                </thead>

                {[...grouped.entries()].map(([programName, acts]) => (
                  // Carga contraída por programa; con filtros activos se expande
                  // para que los resultados sean visibles (el key fuerza remount)
                  <ProgramGroup
                    key={`${programName}-${showCompleted}-${hasFilters ? 'f' : 'c'}`}
                    programName={programName}
                    activities={acts}
                    onSelect={setSelectedAct}
                    selectedId={selectedAct?.id ?? null}
                    defaultOpen={!!hasFilters}
                    highlightId={highlightId}
                  />
                ))}
              </table>
            </div>
          )}
        </div>

        {/* Footer count */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            {filtered.length} actividad(es) en {grouped.size} programa(s)
            {hasFilters && (
              <> · <button onClick={() => { setSearch(''); setFilterProgram(''); setFilterSubject(''); setFilterStatus(''); }} className="text-indigo-500 hover:underline">Limpiar filtros</button></>
            )}
          </span>
          {completedHiddenCount > 0 && (
            <button onClick={() => setShowCompleted(true)} className="text-indigo-500 hover:text-indigo-700 underline">
              {completedHiddenCount} completada{completedHiddenCount !== 1 ? 's' : ''} oculta{completedHiddenCount !== 1 ? 's' : ''} — ver
            </button>
          )}
        </div>
      </div>

      {/* Modal de Detalles de la Decisión */}
      <DecisionDetailModal 
        decision={viewingDecisionDetail}
        open={!!viewingDecisionDetail}
        onClose={() => setViewingDecisionDetail(null)}
      />
    </>
  );
}

function DecisionDetailModal({ decision, open, onClose }: { decision: DecisionRecord | null; open: boolean; onClose: () => void }) {
  if (!decision) return null;

  const overdue = !!decision.due_date
    && decision.status !== 'implemented' && decision.status !== 'cancelled'
    && daysDiff(decision.due_date.slice(0, 10)) < 0;

  return (
    <Modal open={open} onClose={onClose} title="Detalles de la Decisión" size="md">
      <div className="space-y-4">
        {/* Alerta de Vencimiento */}
        {overdue && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2.5 text-sm text-red-700 animate-pulse">
            <AlertCircle className="shrink-0 mt-0.5" size={16} />
            <div>
              <p className="font-semibold">Esta decisión está vencida</p>
              <p className="text-xs text-red-600 mt-0.5">La fecha límite era el {formatDate(decision.due_date!.slice(0, 10))}.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-400 block font-semibold">Estado</span>
            <span className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold mt-1',
              decision.status === 'implemented' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
              decision.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
              decision.status === 'cancelled' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
              'bg-amber-50 text-amber-700 border border-amber-100'
            )}>
              {DECISION_STATUS_LABELS[decision.status]}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block font-semibold">Impacto</span>
            <span className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold mt-1',
              decision.impact === 'high' ? 'bg-red-50 text-red-700 border border-red-100' :
              decision.impact === 'medium' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
              'bg-gray-100 text-gray-700 border border-gray-200'
            )}>
              {DECISION_IMPACT_LABELS[decision.impact]}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block font-semibold">Creada por</span>
            <span className="font-medium text-gray-800 mt-1 block">{decision.creator?.name ?? 'Administrador General'}</span>
          </div>
          <div>
            <span className="text-gray-400 block font-semibold">Responsable asignado</span>
            <span className="font-medium text-gray-800 mt-1 block">{decision.responsible?.name ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block font-semibold">Fecha de Decisión</span>
            <span className="font-medium text-gray-800 mt-1 block">{decision.decision_date ? formatDate(decision.decision_date.slice(0, 10)) : '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block font-semibold">Fecha Límite</span>
            <span className="font-medium text-gray-800 mt-1 block">{decision.due_date ? formatDate(decision.due_date.slice(0, 10)) : 'Sin límite'}</span>
          </div>
        </div>

        {decision.project?.name && (
          <div className="text-xs">
            <span className="text-gray-400 block mb-1 font-semibold">Proyecto relacionado</span>
            <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg font-medium">
              {decision.project.name}
            </span>
          </div>
        )}

        <div className="border-t border-gray-100 pt-3">
          <span className="text-xs text-gray-400 block mb-1 font-semibold">Descripción / Contexto</span>
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {decision.description}
          </div>
        </div>

        {decision.observations && (
          <div className="border-t border-gray-100 pt-3">
            <span className="text-xs text-gray-400 block mb-1 font-semibold">Observaciones / Motivo de cambio</span>
            <div className="bg-violet-50/50 border border-violet-100/50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {decision.observations}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
