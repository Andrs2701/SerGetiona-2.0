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
import type { Workspace, WorkspaceActivity, TimelineEvent, EvidenceLink, ResourceType, ProductionLog, DeliverableFlow, DecisionRecord, DecisionStatus, RoleStatus } from '@/lib/types';
import { ROLE_LABELS, ROLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS, DECISION_STATUS_LABELS, DECISION_IMPACT_LABELS } from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';
import { AlertCircle } from 'lucide-react';

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
  if (act.status === 'approved') {
    if (act.actual_delivery_date && act.commitment_date)
      return act.actual_delivery_date <= act.commitment_date
        ? { label: 'Entregada a tiempo',       cls: 'bg-emerald-100 text-emerald-700' }
        : { label: 'Entregada fuera de tiempo', cls: 'bg-amber-100  text-amber-700'  };
    return { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700' };
  }
  // "Entregado" is a meaningful terminal state — show it clearly before overdue check
  if (act.status === 'delivered')
                                      return { label: 'Entregado',   cls: 'bg-teal-100   text-teal-700'   };
  if (act.date_status === 'overdue') return { label: 'Vencida',     cls: 'bg-red-100    text-red-700'    };
  if (['adjustments_requested', 'with_findings'].includes(act.status))
                                      return { label: 'Devuelta',    cls: 'bg-orange-100 text-orange-700' };
  if (['in_review','in_testing','validating'].includes(act.status))
                                      return { label: 'En Revisión', cls: 'bg-purple-100 text-purple-700' };
  if (['in_progress','in_development','designing','production','implementing','draft','editing','adjusting'].includes(act.status))
                                      return { label: 'En Proceso',  cls: 'bg-blue-100   text-blue-700'   };
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

// Timeline
const TIMELINE_COLORS: Record<string, string> = {
  created: 'bg-indigo-500', assigned: 'bg-sky-500', status: 'bg-blue-500',
  delivered: 'bg-teal-500', date_changed: 'bg-amber-400', note: 'bg-gray-400', approved: 'bg-emerald-500',
};

function TimelineView({ activityId }: { activityId: number }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<{ events: TimelineEvent[] }>(ENDPOINTS.ACTIVITY_TIMELINE(activityId))
      .then((r) => setEvents(r.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [activityId]);

  if (loading) return <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse"/>)}</div>;
  if (!events.length) return <p className="text-sm text-gray-400 py-4 text-center">Sin eventos registrados</p>;

  return (
    <div className="relative pl-5 space-y-4">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-100"/>
      {events.map((ev, i) => (
        <div key={i} className="relative flex gap-3">
          <div className={`absolute -left-3 w-2 h-2 rounded-full mt-1.5 ${TIMELINE_COLORS[ev.type] ?? 'bg-gray-400'}`}/>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800">{ev.label}</p>
            <div className="flex gap-2 mt-0.5 text-[10px] text-gray-400">
              {ev.user && <span>{ev.user}</span>}
              {ev.date && <span>{formatDateTime(ev.date)}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Deliverable-level timeline — shows events from ALL roles in chronological order
const ROLE_DOT_COLORS: Record<string, string> = {
  expert: 'bg-purple-400', pedagogy: 'bg-pink-400', design: 'bg-blue-400',
  audiovisual: 'bg-orange-400', engineering: 'bg-cyan-400', qa: 'bg-emerald-400',
};

function DeliverableTimelineView({ deliverableId, activityRole }: { deliverableId: number; activityRole?: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<{ events: TimelineEvent[] }>(ENDPOINTS.DELIVERABLE_TIMELINE(deliverableId))
      .then((r) => setEvents(r.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [deliverableId]);

  if (loading) return <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse"/>)}</div>;
  if (!events.length) return <p className="text-sm text-gray-400 py-4 text-center">Sin eventos registrados</p>;

  // For creation/assignment events, only show the current user's own role; all other event types are shown for all roles
  const filtered = activityRole
    ? events.filter(ev => (ev.type !== 'created' && ev.type !== 'assigned') || ev.role === activityRole)
    : events;

  return (
    <div className="relative pl-5 space-y-4">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-100"/>
      {filtered.map((ev, i) => {
        const dotColor = ev.role ? (ROLE_DOT_COLORS[ev.role] ?? 'bg-gray-400') : (TIMELINE_COLORS[ev.type] ?? 'bg-gray-400');
        return (
          <div key={i} className="relative flex gap-3">
            <div className={`absolute -left-3 w-2 h-2 rounded-full mt-1.5 ${dotColor}`}/>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{ev.label}</p>
              <div className="flex gap-2 mt-0.5 text-[10px] text-gray-400">
                {ev.user && <span>{ev.user}</span>}
                {ev.date && <span>{formatDateTime(ev.date)}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Evidence links — controlled pending state, submits via parent handleSave
function EvidenceLinksPanel({
  activityId,
  pendingUrl, setPendingUrl,
  pendingTitle, setPendingTitle,
  onLinksLoaded,
  refreshKey,
  disabled = false,
}: {
  activityId: number;
  pendingUrl: string; setPendingUrl: (u: string) => void;
  pendingTitle: string; setPendingTitle: (t: string) => void;
  onLinksLoaded: (count: number) => void;
  refreshKey: number;
  disabled?: boolean;
}) {
  const [links, setLinks] = useState<EvidenceLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<EvidenceLink[]>(ENDPOINTS.ACTIVITY_EVIDENCE(activityId))
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setLinks(arr);
        onLinksLoaded(arr.length);
      })
      .catch(() => { setLinks([]); onLinksLoaded(0); })
      .finally(() => setLoading(false));
  }, [activityId, refreshKey]);

  async function handleDelete(id: number) {
    await api.delete(`/evidence/${id}`);
    setLinks(p => {
      const updated = p.filter(x => x.id !== id);
      onLinksLoaded(updated.length);
      return updated;
    });
  }

  if (loading) return <div className="h-10 bg-gray-50 dark:bg-gray-700/30 rounded animate-pulse"/>;

  return (
    <div className="space-y-2">
      {links.map(l => (
        <div key={l.id} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
          <Link2 size={13} className="text-indigo-400 flex-shrink-0"/>
          <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate">{l.title || l.url}</a>
          <ExternalLink size={11} className="text-gray-300 flex-shrink-0"/>
          {!disabled && (
            <button onClick={() => handleDelete(l.id)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={12}/></button>
          )}
        </div>
      ))}
      {!disabled && (
        <div className="space-y-1.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <input value={pendingTitle} onChange={e => setPendingTitle(e.target.value)}
            placeholder="Título (ej: Entrega Drive Semana 1)"
            className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 bg-white dark:bg-gray-700"/>
          <input value={pendingUrl} onChange={e => setPendingUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 bg-white dark:bg-gray-700"/>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Se guardará junto con los demás cambios</p>
        </div>
      )}
    </div>
  );
}

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

// ─── Quick Production Grid ────────────────────────────────────────────────────
// quantities/date live in parent (DetailPanel); no Registrar button here

function QuickProductionGrid({
  activityId, role,
  quantities, onQuantityChange,
  date, onDateChange,
  onLogsLoaded, refreshKey,
  naResources, onNAResourcesChange,
  onResourceTypesLoaded,
  disabled = false,
}: {
  activityId: number; role: string;
  quantities: Record<number, number>;
  onQuantityChange: (id: number, qty: number) => void;
  date: string; onDateChange: (d: string) => void;
  onLogsLoaded: (count: number) => void;
  refreshKey: number;
  naResources: Set<number>;
  onNAResourcesChange: (s: Set<number>) => void;
  onResourceTypesLoaded: (count: number) => void;
  disabled?: boolean;
}) {
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<{ data: ResourceType[] }>(`${ENDPOINTS.RESOURCE_TYPES}?role=${role}`)
        .then(r => {
          const types = ((r.data ?? r) as ResourceType[]).filter(rt => rt.is_active);
          setResourceTypes(types);
          onResourceTypesLoaded(types.length);
        }),
      api.get<{ data: ProductionLog[] }>(ENDPOINTS.ACTIVITY_PRODUCTION(activityId))
        .then(r => {
          const data = (r.data ?? r) as ProductionLog[];
          setLogs(data);
          onLogsLoaded(data.length);
        }),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [activityId, role, refreshKey]);

  async function handleDelete(id: number) {
    try {
      await api.delete(`/production-logs/${id}`);
      setLogs(p => {
        const updated = p.filter(l => l.id !== id);
        onLogsLoaded(updated.length);
        return updated;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('409')) {
        alert('No se puede eliminar: la actividad ya fue entregada.');
      } else {
        // Intentar parsear mensaje JSON del backend
        let friendlyMessage = 'Error al eliminar.';
        try {
          const jsonStart = msg.indexOf('{');
          if (jsonStart !== -1) {
            const errorJson = JSON.parse(msg.substring(jsonStart));
            if (errorJson.message) {
              friendlyMessage = errorJson.message;
            }
          } else if (msg) {
            friendlyMessage = msg;
          }
        } catch (parseError) {
          if (msg) friendlyMessage = msg;
        }
        alert(friendlyMessage);
      }
    }
  }

  if (loading) return <div className="h-16 bg-gray-50 dark:bg-gray-700/30 rounded animate-pulse"/>;
  if (!resourceTypes.length) return <p className="text-xs text-gray-400 dark:text-gray-500 py-1">Este rol no tiene tipos de recurso configurados.</p>;

  return (
    <div className="space-y-2.5">
      {logs.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2.5 space-y-1">
          <p className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-1">Ya registrado</p>
          {logs.map(l => (
            <div key={l.id} className="flex items-center justify-between text-xs">
              <span className="text-indigo-600 dark:text-indigo-400">{l.resource_type?.name} <span className="font-bold text-indigo-800 dark:text-indigo-200">x{l.quantity}</span></span>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span>{l.produced_at ? formatDate(l.produced_at.split('T')[0]) : ''}</span>
                {!disabled && (
                  <button onClick={() => handleDelete(l.id)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={10}/></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <>
          <div className="space-y-1">
            {resourceTypes.map(rt => {
              const isNA = naResources.has(rt.id);
              return (
                <div key={rt.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg px-2.5 py-1.5">
                  <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate" title={rt.name}>{rt.name}</span>
                  {isNA ? (
                    <span className="text-xs text-gray-400 italic w-12 text-center">N/A</span>
                  ) : (
                    <input type="number" min={0}
                      value={quantities[rt.id] ?? ''}
                      placeholder="0"
                      onChange={e => onQuantityChange(rt.id, Math.max(0, Number(e.target.value)))}
                      className="w-12 text-center text-xs border border-gray-200 dark:border-gray-600 rounded-md px-1 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(naResources);
                      if (isNA) { next.delete(rt.id); } else { next.add(rt.id); }
                      onNAResourcesChange(next);
                    }}
                    className={clsx(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors flex-shrink-0',
                      isNA
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-500'
                        : 'bg-white dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400 hover:text-gray-500'
                    )}>
                    N/A
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Fecha prod.</label>
            <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"/>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step header (numbered section title) ─────────────────────────────────────

function StepHeader({ step, label, done }: { step: number; label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={clsx(
        'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 transition-colors',
        done
          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
          : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
      )}>{step}</span>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-1">{label}</p>
      {done && <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0"/>}
    </div>
  );
}

// ─── Detail side panel ────────────────────────────────────────────────────────

function DetailPanel({
  act,
  onClose,
  onStatusChange,
  isManager,
  onSaved,
  roleStatuses,
}: {
  act: WorkspaceActivity;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
  isManager: boolean;
  onSaved: () => void;
  roleStatuses: RoleStatus[];
}) {
  const [tab, setTab] = useState<PanelTab>('principal');
  const [status, setStatus] = useState(act.status);
  const [notes, setNotes] = useState(act.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lifted production state — submitted by handleSave, not by QuickProductionGrid
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [prodDate, setProdDate] = useState(new Date().toISOString().split('T')[0]);
  const [existingLogsCount, setExistingLogsCount] = useState(0);
  const [naResources, setNaResources] = useState<Set<number>>(new Set());
  const [totalResourceTypes, setTotalResourceTypes] = useState(0);
  // Lifted evidence link state — submitted by handleSave, not by EvidenceLinksPanel
  const [pendingUrl, setPendingUrl] = useState('');
  const [pendingTitle, setPendingTitle] = useState('');
  const [existingLinksCount, setExistingLinksCount] = useState(0);
  // Increment to re-fetch child components after save
  const [refreshKey, setRefreshKey] = useState(0);

  // Reset all when switching activity
  useEffect(() => {
    setStatus(act.status);
    setNotes(act.notes ?? '');
    setSaved(false);
    setSaveError(null);
    setQuantities({});
    setProdDate(new Date().toISOString().split('T')[0]);
    setNaResources(new Set());
    setTotalResourceTypes(0);
    setPendingUrl('');
    setPendingTitle('');
    setExistingLogsCount(0);
    setExistingLinksCount(0);
    setRefreshKey(k => k + 1);
  }, [act.id]);

  const allStates = useMemo(() => {
    const associated = roleStatuses
      .filter((rs) => rs.role === act.role)
      .map((rs) => rs.status_slug);
    return associated.length > 0 ? associated : Object.keys(ROLE_STATUS_LABELS);
  }, [roleStatuses, act.role]);

  const roleStates = useMemo(() => {
    let states = isManager
      ? allStates
      : allStates.filter(s => !MANAGER_ONLY_STATUSES.includes(s));
    
    if (!states.includes(act.status)) {
      states = [...states, act.status];
    }
    return states;
  }, [allStates, isManager, act.status]);

  const isReadOnly = !isManager && ['delivered', 'approved'].includes(act.status);

  const isProdRole = PRODUCTION_ROLES.has(act.role);
  const toPost = Object.entries(quantities)
    .filter(([rtId, qty]) => qty > 0 && !naResources.has(Number(rtId)))
    .map(([rtId, qty]) => ({ resource_type_id: Number(rtId), quantity: qty }));
  const hasProduction = existingLogsCount > 0 || toPost.length > 0;
  const allProductionNA = totalResourceTypes > 0 && naResources.size >= totalResourceTypes;
  const hasPendingLink = pendingUrl.trim() !== '' && pendingTitle.trim() !== '';
  const hasLink = existingLinksCount > 0 || hasPendingLink;
  const prodStep = isProdRole ? 2 : undefined;
  const linkStep = isProdRole ? 3 : 2;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    // Validate before delivery — bypassed if all resources are marked N/A
    if (status === 'delivered' && isProdRole && !allProductionNA) {
      if (!hasProduction) {
        setSaveError(`Completa la sección ${prodStep} – Producción antes de marcar como Entregado, o marca todos los recursos como N/A.`);
        setSaving(false);
        return;
      }
      if (!hasLink) {
        setSaveError(`Completa la sección ${linkStep} – Enlace de entrega antes de marcar como Entregado.`);
        setSaving(false);
        return;
      }
    }

    try {
      // 1. PUT status + notes + production_not_applicable (true only when ALL resources are N/A'd)
      // Se ejecuta primero porque es la acción de negocio y la validación principal de permisos.
      // Si el PUT falla (ej: sin permisos, ya aprobado, etc.), la ejecución se interrumpe y se evita la acumulación de producción.
      await api.put(ENDPOINTS.ROLE_ACTIVITY(act.id), { status, notes, production_not_applicable: allProductionNA });

      // 2. POST production quantities in parallel
      if (toPost.length > 0) {
        await Promise.all(toPost.map(item =>
          api.post(ENDPOINTS.ACTIVITY_PRODUCTION(act.id), { ...item, produced_at: prodDate })
        ));
        setQuantities({});
      }

      // 3. POST pending evidence link
      if (hasPendingLink) {
        await api.post(ENDPOINTS.ACTIVITY_EVIDENCE(act.id), {
          type: 'url', title: pendingTitle.trim(), url: pendingUrl.trim(),
        });
        setPendingUrl('');
        setPendingTitle('');
      }

      onStatusChange(act.id, status);
      setSaved(true);
      setRefreshKey(k => k + 1);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e) {
      setStatus(act.status);
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('requires_production') || msg.includes('registrar al menos un recurso')) {
        setSaveError(`Completa la sección ${prodStep} – Producción antes de marcar como Entregado.`);
      } else {
        // Intentar parsear el mensaje de error devuelto por el servidor en formato JSON
        let friendlyMessage = 'No se pudo guardar. Verifica tus permisos e intenta de nuevo.';
        try {
          const jsonStart = msg.indexOf('{');
          if (jsonStart !== -1) {
            const errorJson = JSON.parse(msg.substring(jsonStart));
            if (errorJson.message) {
              friendlyMessage = errorJson.message;
            }
          } else if (msg) {
            friendlyMessage = msg;
          }
        } catch (parseError) {
          if (msg) friendlyMessage = msg;
        }
        setSaveError(friendlyMessage);
      }
      setTimeout(() => setSaveError(null), 6000);
    }
    setSaving(false);
  }

  const TABS: { id: PanelTab; label: string; icon: React.ElementType }[] = [
    { id: 'principal',   label: 'Actividad',        icon: GitCommitHorizontal },
    { id: 'evidencias',  label: 'Evidencias',       icon: Package },
    { id: 'timeline',    label: 'Línea de tiempo',  icon: Clock },
  ];

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20" onClick={onClose}/>
      <div className="w-full sm:w-[420px] max-w-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col h-full border-l border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">{act.program?.name ?? '—'} › {act.subject?.name ?? '—'}</p>
            <h3 className="font-semibold text-gray-900 text-sm leading-snug">{act.deliverable?.name ?? '—'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"><X size={18}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
                tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              <Icon size={12}/>{label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'principal' && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">

              {/* ── Paso 1: Información ── */}
              <div className="px-4 py-3 space-y-2.5">
                <StepHeader step={1} label="Información"/>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-2">
                  {[
                    ['Programa', act.program?.name ?? '—'],
                    ['Asignatura', act.subject?.name ?? '—'],
                    ['Semana / Módulo', act.deliverable?.name ?? '—'],
                    ...(act.deliverable?.type ? [['Tipo', DELIVERABLE_TYPE_LABELS[act.deliverable.type]]] : []),
                    ...(act.deliverable?.semestre ? [['Semestre', act.deliverable.semestre]] : []),
                    ...(act.deliverable?.ciclo    ? [['Ciclo',    act.deliverable.ciclo]]    : []),
                    ['Fecha límite', act.commitment_date ? formatDate(act.commitment_date) : '—'],
                    ...(act.actual_delivery_date ? [['Entregado el', formatDate(act.actual_delivery_date)]] : []),
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Estado</p>
                  <select value={status} onChange={e => setStatus(e.target.value)} disabled={isReadOnly}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700">
                    {roleStates.map(s => <option key={s} value={s}>{ROLE_STATUS_LABELS[s] ?? s}</option>)}
                  </select>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={1} disabled={isReadOnly}
                    placeholder="Notas u observaciones..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 bg-white dark:bg-gray-700"/>
                </div>
              </div>

              {/* ── Paso 2: Producción (solo roles productivos) ── */}
              {isProdRole && (
                <div className="px-4 py-3 space-y-2.5">
                  <StepHeader step={2} label="Producción" done={hasProduction || allProductionNA}/>
                  <div className="mt-1">
                    <QuickProductionGrid
                      activityId={act.id}
                      role={act.role}
                      quantities={quantities}
                      onQuantityChange={(id, qty) => setQuantities(q => ({ ...q, [id]: qty }))}
                      date={prodDate}
                      onDateChange={setProdDate}
                      onLogsLoaded={setExistingLogsCount}
                      refreshKey={refreshKey}
                      naResources={naResources}
                      onNAResourcesChange={setNaResources}
                      onResourceTypesLoaded={setTotalResourceTypes}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              )}

              {/* ── Paso 2 o 3: Enlace de entrega ── */}
              <div className="px-4 py-3 space-y-2.5">
                <StepHeader step={linkStep} label="Enlace de entrega" done={hasLink}/>
                <div className="mt-1">
                  <EvidenceLinksPanel
                    activityId={act.id}
                    pendingUrl={pendingUrl}
                    setPendingUrl={setPendingUrl}
                    pendingTitle={pendingTitle}
                    setPendingTitle={setPendingTitle}
                    onLinksLoaded={setExistingLinksCount}
                    refreshKey={refreshKey}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

            </div>
          )}
          {tab === 'evidencias' && act.deliverable && (
            <div className="p-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                Información registrada por cada rol durante el flujo de producción de este entregable.
              </p>
              <EvidenciasTab deliverableId={act.deliverable.id}/>
            </div>
          )}
          {tab === 'comentarios' && (
            <div className="p-5">
              {act.deliverable && <CommentsPanel deliverableId={act.deliverable.id}/>}
            </div>
          )}
          {tab === 'timeline' && (
            <div className="p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Historial de cambios</p>
              {act.deliverable
                ? <DeliverableTimelineView deliverableId={act.deliverable.id} activityRole={act.role}/>
                : <TimelineView activityId={act.id}/>
              }
            </div>
          )}
        </div>

        {/* ── Sticky save footer (principal tab only) ── */}
        {tab === 'principal' && !isReadOnly && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0 space-y-2">
            {saveError && (
              <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {saveError}
              </p>
            )}
            {status === 'delivered' && isProdRole && !allProductionNA && (!hasProduction || !hasLink) && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
                Para Entregado: registra producción y enlace, o marca todos los recursos como N/A.
              </p>
            )}
            <button onClick={handleSave} disabled={saving}
              className={clsx('w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors',
                saved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700',
                saving && 'opacity-60')}>
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
        <p className="truncate" title={act.deliverable?.name ?? '—'}>{act.deliverable?.name ?? '—'}</p>
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

  const [roleStatuses, setRoleStatuses] = useState<RoleStatus[]>([]);

  useEffect(() => {
    api.get<{ role_statuses: RoleStatus[] }>('/config/role-statuses')
      .then((res) => setRoleStatuses(res.role_statuses ?? []))
      .catch(() => setRoleStatuses([]));
  }, []);

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
  const overdue   = activities.filter(a => a.date_status === 'overdue' && a.status !== 'approved').length;
  const approaching = activities.filter(a => a.date_status === 'approaching' && a.status !== 'approved').length;
  const completed = activities.filter(a => a.status === 'approved').length;

  const completedHiddenCount = useMemo(
    () => !showCompleted && filterStatus !== 'completed'
      ? activities.filter(a => a.status === 'approved').length
      : 0,
    [activities, showCompleted, filterStatus]
  );

  // Filter activities
  const filtered = useMemo(() => activities
    .filter(a => {
      // Hide approved unless user toggled showCompleted or explicitly filtered for completed
      if (!showCompleted && filterStatus !== 'completed' && a.status === 'approved') return false;
      if (search && ![a.deliverable?.name ?? '', a.subject?.name ?? '', a.program?.name ?? ''].some(s => s.toLowerCase().includes(search.toLowerCase()))) return false;
      if (filterProgram && (a.program?.name ?? '') !== filterProgram) return false;
      if (filterSubject && (a.subject?.name ?? '') !== filterSubject) return false;
      if (filterStatus === 'pending')    return ['not_started','pending'].includes(a.status);
      if (filterStatus === 'overdue')    return a.date_status === 'overdue';
      if (filterStatus === 'approaching')return a.date_status === 'approaching';
      if (filterStatus === 'in_process') return ['in_progress','in_development','designing','production','implementing','draft','editing','adjusting'].includes(a.status);
      if (filterStatus === 'completed')  return a.status === 'approved';
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
      {selectedAct && (
        <DetailPanel act={selectedAct} onClose={() => setSelectedAct(null)} onStatusChange={handleStatusChange} isManager={isManager} onSaved={loadWorkspace} roleStatuses={roleStatuses}/>
      )}

      <div className="p-4 sm:p-6 space-y-5">
        {/* Heading */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Espacio de Trabajo</h1>
          <p className="text-sm text-gray-500 mt-0.5">{roleLabel} · {total} actividades asignadas</p>
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
            { id: 'in_process' as StatusFilter, label: 'En proceso',  count: activities.filter(a => ['in_progress','in_development','designing','production','implementing','draft','editing','adjusting'].includes(a.status)).length, icon: null, cls: 'text-blue-600' },
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
