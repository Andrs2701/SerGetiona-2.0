'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Clock, Link2, MessageSquare, GitCommitHorizontal, Trash2, ExternalLink, Package, Calendar, User as UserIcon, Send, CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { EvidenceLink, ResourceType, ProductionLog, ComplexityLevel, RoleStatus, Role, DeliverableType, DeliverableFlow } from '@/lib/types';
import { ROLE_LABELS, ROLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from '@/lib/types';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';

const ROLE_ABBR: Record<Role, string> = {
  expert: 'EXP', pedagogy: 'PED', design: 'DIS',
  audiovisual: 'AUD', engineering: 'ING', qa: 'QA',
};

const ROLE_BADGE_BG: Record<Role, string> = {
  expert: 'bg-violet-500', pedagogy: 'bg-blue-500', design: 'bg-pink-500',
  audiovisual: 'bg-amber-500', engineering: 'bg-teal-500', qa: 'bg-emerald-600',
};

const ROLE_CELL_COLORS: Record<Role, { bg: string; border: string; label: string }> = {
  expert:      { bg: 'bg-violet-50 dark:bg-violet-950/20',  border: 'border-violet-100 dark:border-violet-900/30',  label: 'text-violet-700 dark:text-violet-300' },
  pedagogy:    { bg: 'bg-blue-50 dark:bg-blue-950/20',    border: 'border-blue-100 dark:border-blue-900/30',    label: 'text-blue-700 dark:text-blue-300' },
  design:      { bg: 'bg-pink-50 dark:bg-pink-950/20',    border: 'border-pink-100 dark:border-pink-900/30',    label: 'text-pink-700 dark:text-pink-300' },
  audiovisual: { bg: 'bg-amber-50 dark:bg-amber-950/20',   border: 'border-amber-100 dark:border-amber-900/30',   label: 'text-amber-700 dark:text-amber-400' },
  engineering: { bg: 'bg-teal-50 dark:bg-teal-950/20',    border: 'border-teal-100 dark:border-teal-900/30',    label: 'text-teal-700 dark:text-teal-300' },
  qa:          { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/30', label: 'text-emerald-700 dark:text-emerald-300' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

const MANAGER_ONLY_STATUSES = ['approved'];
const PRODUCTION_ROLES = new Set(['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']);

// Timeline colors
const TIMELINE_COLORS: Record<string, string> = {
  created: 'bg-indigo-500', assigned: 'bg-sky-500', status: 'bg-blue-500',
  delivered: 'bg-teal-500', date_changed: 'bg-amber-400', note: 'bg-gray-400', approved: 'bg-emerald-500',
};

interface TimelineEvent {
  type: string;
  label: string;
  user?: string;
  date?: string;
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

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
        const isNotStarted = r.status === 'not_started';
        const isNotApplicable = r.status === 'not_applicable';
        const statusColor = STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-500';
        // "Ajustes Realizados": ya entregó más de una vez (pasó por un ciclo
        // de hallazgos) — sigue siendo delivered/approved funcionalmente,
        // solo cambia el texto para que quede claro que hubo una corrección.
        const wasReturned = (r.status === 'delivered' || r.status === 'approved')
          && !!r.first_delivered_at && !!r.actual_delivery_date
          && r.first_delivered_at !== r.actual_delivery_date;
        const roleStatusLabel = wasReturned ? 'Ajustes Realizados' : (ROLE_STATUS_LABELS[r.status] ?? r.status);
        return (
          <div key={r.role} className={clsx(
            "border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden transition-all duration-200",
            isNotStarted && "opacity-60 saturate-50 hover:opacity-85 hover:saturate-100",
            isNotApplicable && "opacity-40 select-none bg-gray-50 dark:bg-gray-800/10"
          )}>
            {/* Role header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                  {ROLE_LABELS_LOCAL[r.role] ?? r.role}
                </span>
                {r.responsible && <span className="text-[10px] text-gray-400 truncate">— {r.responsible.name}</span>}
              </div>
              <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0', statusColor)}>
                {roleStatusLabel}
              </span>
            </div>

            {/* Content */}
            <div className="px-3 py-2.5 space-y-2.5">
              {/* Fechas de la Célula */}
              {!isNotApplicable && (r.commitment_date || r.actual_delivery_date) && (
                <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400 pb-1.5 border-b border-gray-100 dark:border-gray-700/40">
                  {r.commitment_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} className="text-gray-400"/>
                      Límite: <strong className="text-gray-600 dark:text-gray-300">{formatDate(r.commitment_date)}</strong>
                    </span>
                  )}
                  {(r.first_delivered_at || r.actual_delivery_date) && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-emerald-500"/>
                      Entregado: <strong className="text-emerald-600 dark:text-emerald-400">{formatDate(r.first_delivered_at ?? r.actual_delivery_date)}</strong>
                    </span>
                  )}
                  {wasReturned && r.actual_delivery_date && r.first_delivered_at && r.first_delivered_at !== r.actual_delivery_date && (
                    <span className="text-gray-400">
                      (Ajustes reentregados: {formatDate(r.actual_delivery_date)})
                    </span>
                  )}
                </div>
              )}

              {/* Production resources */}
              {r.production.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Recursos producidos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.production.map(p => (
                      <span key={`${p.resource_type}-${p.complexity_level ?? 'na'}`} className="inline-flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                        {p.resource_type} <span className="font-bold">({p.total})</span>
                        {p.complexity_level && (
                          <span className="ml-0.5 px-1.5 py-0 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-semibold">
                            {p.complexity_level}
                          </span>
                        )}
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

              {/* Observations history */}
              {(r.observations ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Observaciones</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {(r.observations ?? []).map(obs => (
                      <div key={obs.id} className="flex gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                          {obs.user?.name?.[0] ?? '?'}
                        </div>
                        <div className="flex-1 bg-gray-50 dark:bg-gray-700/20 rounded-lg px-2.5 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate">{obs.user?.name}</p>
                            <p className="text-[9px] text-gray-400 flex-shrink-0">{formatDate(obs.created_at?.split('T')[0] ?? '')}</p>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 whitespace-pre-wrap leading-relaxed">{obs.observation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!r.production.length && !r.links.length && !(r.observations ?? []).length && (
                <p className="text-xs text-gray-400 py-1">{isNotApplicable ? 'Rol no aplica para este entregable.' : 'Sin registros para este rol.'}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
    try {
      await api.delete(`/evidence/${id}`);
      setLinks(p => {
        const updated = p.filter(x => x.id !== id);
        onLinksLoaded(updated.length);
        return updated;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      alert(msg.includes('409') ? 'No se puede eliminar: la actividad ya fue entregada o aprobada.' : 'Error al eliminar.');
    }
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
            placeholder="Título (ej: Entrega Semana 1)"
            className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 bg-white dark:bg-gray-700"/>
          <input value={pendingUrl} onChange={e => setPendingUrl(e.target.value)}
            placeholder="https://sharepoint.com/... o Campus Virtual"
            className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 bg-white dark:bg-gray-700"/>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Se guardará junto con los demás cambios</p>
        </div>
      )}
    </div>
  );
}

function QuickProductionGrid({
  activityId, role,
  quantities, onQuantityChange,
  date, onDateChange,
  onLogsLoaded, refreshKey,
  naResources, onNAResourcesChange,
  onResourceTypesLoaded,
  complexities, onComplexityChange,
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
  complexities: Record<number, number>;
  onComplexityChange: (id: number, levelId: number) => void;
  disabled?: boolean;
}) {
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [levels, setLevels] = useState<ComplexityLevel[]>([]);
  const [loading, setLoading] = useState(true);

  // Los niveles se administran en Configuración → Complejidad; se leen del
  // catálogo en vez de hardcodearlos para que agregar o renombrar uno no
  // requiera tocar código.
  useEffect(() => {
    api.get<{ levels: ComplexityLevel[] }>(ENDPOINTS.COMPLEXITY_LEVELS)
      .then(r => setLevels(r.levels ?? []))
      .catch(() => setLevels([]));
  }, []);

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
        alert('No se puede eliminar: la actividad ya fue entregada o aprobada.');
      } else {
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
              <span className="text-indigo-600 dark:text-indigo-400">
                {l.resource_type?.name}{' '}
                <span className="font-bold text-indigo-800 dark:text-indigo-200">x{l.quantity}</span>
                {l.complexity_level?.name && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 rounded">
                    {l.complexity_level.name}
                  </span>
                )}
              </span>
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
              const qty = quantities[rt.id] ?? 0;
              return (
                <div key={rt.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg px-2.5 py-1.5">
                  <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate" title={rt.name}>{rt.name}</span>
                  {isNA ? (
                    <span className="text-xs text-gray-400 italic w-12 text-center">N/A</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {levels.length > 0 && (
                        <select
                          value={complexities[rt.id] ?? levels[0].id}
                          onChange={e => onComplexityChange(rt.id, Number(e.target.value))}
                          className="text-[10px] font-semibold border border-indigo-200 dark:border-indigo-800 rounded-md px-1 py-0.5 bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      )}
                      <input type="number" min={0}
                        value={quantities[rt.id] ?? ''}
                        placeholder="0"
                        onChange={e => onQuantityChange(rt.id, Math.max(0, Number(e.target.value)))}
                        className="w-12 text-center text-xs border border-gray-200 dark:border-gray-600 rounded-md px-1 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
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
    </div>
  );
}

interface ObservationItem {
  id: number;
  user: { name: string };
  observation: string;
  created_at: string;
}

function ObservationsPanel({
  activityId,
  pendingText, setPendingText,
  refreshKey,
}: {
  activityId: number;
  pendingText: string; setPendingText: (t: string) => void;
  refreshKey: number;
}) {
  const [observations, setObservations] = useState<ObservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchObservations = useCallback(() => {
    api.get<ObservationItem[]>(`/activities/${activityId}/observations`)
      .then(r => setObservations(Array.isArray(r) ? r : []))
      .catch(() => setObservations([]))
      .finally(() => setLoading(false));
  }, [activityId]);

  useEffect(() => {
    fetchObservations();
  }, [fetchObservations, refreshKey]);

  // Envío inmediato (sin esperar a "Guardar cambios"), para cuando la usuaria
  // solo quiere dejar una observación sin tocar el resto del formulario. Si
  // en cambio deja texto pendiente y da clic en "Guardar cambios", ese botón
  // también la envía — ver handleSave en el componente principal.
  async function handleSend() {
    if (!pendingText.trim()) return;
    setSending(true);
    try {
      const newObs = await api.post<ObservationItem>(`/activities/${activityId}/observations`, { observation: pendingText.trim() });
      setObservations(p => [...p, newObs]);
      setPendingText('');
    } catch { /* ignore */ }
    setSending(false);
  }

  if (loading) return <div className="space-y-1.5 mt-3">{[...Array(2)].map((_,i) => <div key={i} className="h-10 bg-gray-50 dark:bg-gray-700/20 rounded animate-pulse"/>)}</div>;

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Historial de Observaciones</p>
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {!observations.length && <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin observaciones registradas aún.</p>}
        {observations.map((obs) => (
          <div key={obs.id} className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {obs.user?.name?.[0] ?? '?'}
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-gray-700/20 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{obs.user?.name}</p>
                <p className="text-[9px] text-gray-400 flex-shrink-0">{formatDateTime(obs.created_at)}</p>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap leading-relaxed">{obs.observation}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={pendingText} onChange={e => setPendingText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Escribe una observación en el historial..."
          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 bg-white dark:bg-gray-700"/>
        <button onClick={handleSend} disabled={sending || !pendingText.trim()}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0">
          <Send size={12}/>
        </button>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-1">Se guarda al presionar Enter o con "Guardar cambios" de abajo.</p>
    </div>
  );
}

// ─── Componente Principal ───────────────────────────────────────────────────

export default function ActivityDetailPanel({
  activity,
  deliverable,
  onClose,
  onStatusChange,
  isManager,
  onSaved,
}: {
  activity: {
    id: number;
    role: Role;
    status: string;
    notes?: string;
    commitment_date?: string;
    actual_start_date?: string;
    actual_delivery_date?: string;
    first_delivered_at?: string;
    responsible?: { id: number; name: string } | null;
    priority?: string;
  };
  deliverable: {
    id: number;
    name: string;
    type: string;
    priority?: string;
    semestre?: string | null;
    ciclo?: string | null;
    subject?: { id: number; name: string } | null;
    program?: { id: number; name: string } | null;
  };
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
  isManager: boolean;
  onSaved: () => void;
}) {
  const programName = (deliverable as any).program_name || (deliverable as any).program?.name || (activity as any).program?.name || '—';
  const subjectName = (deliverable as any).subject_name || (deliverable as any).subject?.name || (activity as any).subject?.name || '—';

  const { statuses: taskStatuses, loading: loadingStatuses } = useTaskStatuses(activity.role);

  const [tab, setTab] = useState<'principal' | 'evidencias' | 'timeline'>('principal');
  const [status, setStatus] = useState(activity.status);
  const [notes, setNotes] = useState(activity.notes ?? '');
  const [priorityState, setPriorityState] = useState(deliverable.priority ?? activity.priority ?? 'media');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingObservation, setPendingObservation] = useState('');

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [prodDate, setProdDate] = useState(new Date().toISOString().split('T')[0]);
  const [existingLogsCount, setExistingLogsCount] = useState(0);
  const [naResources, setNaResources] = useState<Set<number>>(new Set());
  const [totalResourceTypes, setTotalResourceTypes] = useState(0);

  const [pendingUrl, setPendingUrl] = useState('');
  const [pendingTitle, setPendingTitle] = useState('');
  const [existingLinksCount, setExistingLinksCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [flowData, setFlowData] = useState<DeliverableFlow | null>(null);
  const [selectedRolesToAdjust, setSelectedRolesToAdjust] = useState<string[]>([]);
  const [complexities, setComplexities] = useState<Record<number, number>>({});

  useEffect(() => {
    if (activity.role === 'qa' && ['adjustments_requested', 'with_findings'].includes(status)) {
      api.get<DeliverableFlow>(ENDPOINTS.DELIVERABLE_FLOW(deliverable.id))
        .then(res => setFlowData(res))
        .catch(() => setFlowData(null));
    } else {
      setFlowData(null);
      setSelectedRolesToAdjust([]);
    }
  }, [activity.role, status, deliverable.id]);

  const adjustableRoles = useMemo(() => {
    if (!flowData) return [];
    return flowData.roles.filter(r => r.role !== 'qa' && r.status !== 'not_applicable' && r.responsible);
  }, [flowData]);

  useEffect(() => {
    setStatus(activity.status);
    setNotes(activity.notes ?? '');
    setPriorityState(deliverable.priority ?? activity.priority ?? 'media');
    setSaved(false);
    setSaveError(null);
    setQuantities({});
    setComplexities({});
    setProdDate(new Date().toISOString().split('T')[0]);
    setNaResources(new Set());
    setTotalResourceTypes(0);
    setPendingUrl('');
    setPendingTitle('');
    setPendingObservation('');
    setExistingLogsCount(0);
    setExistingLinksCount(0);
    setRefreshKey(k => k + 1);
    setSelectedRolesToAdjust([]);
    setFlowData(null);
  }, [activity.id, deliverable.priority, activity.priority]);

  const roleStates = useMemo(() => {
    if (loadingStatuses) return [];
    let states = taskStatuses.map((s) => s.slug);
    if (!states.includes(activity.status)) {
      states = [...states, activity.status];
    }
    return states;
  }, [taskStatuses, loadingStatuses, activity.status]);

  const isReadOnly = !isManager && ['delivered', 'approved', 'not_applicable'].includes(activity.status);
  const isProdRole = PRODUCTION_ROLES.has(activity.role);
  const toPost = Object.entries(quantities)
    .filter(([rtId, qty]) => qty > 0 && !naResources.has(Number(rtId)))
    .map(([rtId, qty]) => ({
      resource_type_id: Number(rtId),
      quantity: qty,
      complexity_level_id: complexities[Number(rtId)] ?? null,
    }));
  const hasProduction = existingLogsCount > 0 || toPost.length > 0;
  const allProductionNA = totalResourceTypes > 0 && naResources.size === totalResourceTypes;

  const hasPendingLink = pendingUrl.trim() !== '' && pendingTitle.trim() !== '';
  const hasLink = existingLinksCount > 0 || hasPendingLink;
  const hasPendingObservation = pendingObservation.trim() !== '';
  const prodStep = isProdRole ? 2 : undefined;
  const linkStep = isProdRole ? 3 : 2;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    // Solo exigir producción si el rol tiene tipos de recurso configurados y no todos están marcados como N/A
    const requiresProduction = isProdRole && totalResourceTypes > 0 && !allProductionNA;

    if (status === 'delivered' && requiresProduction) {
      if (!hasProduction) {
        setSaveError(`Completa la sección ${prodStep} – Producción antes de marcar como Entregado.`);
        setSaving(false);
        return;
      }
      if (!hasLink) {
        setSaveError(`Completa la sección ${linkStep} – Enlace de entrega antes de marcar como Entregado.`);
        setSaving(false);
        return;
      }
    }

    // Si el rol no tiene producción pero sí requiere enlace (ej: QA), validar enlace
    if (status === 'delivered' && isProdRole && totalResourceTypes === 0 && !hasLink) {
      setSaveError(`Completa la sección de Enlace de entrega antes de marcar como Entregado.`);
      setSaving(false);
      return;
    }

    try {
      if (toPost.length > 0) {
        await Promise.all(toPost.map(item =>
          api.post(ENDPOINTS.ACTIVITY_PRODUCTION(activity.id), { ...item, produced_at: prodDate })
        ));
        setQuantities({});
      }

      if (hasPendingLink) {
        await api.post(ENDPOINTS.ACTIVITY_EVIDENCE(activity.id), {
          type: 'url', title: pendingTitle.trim(), url: pendingUrl.trim(),
        });
        setPendingUrl('');
        setPendingTitle('');
      }

      // Antes, escribir una observación y cambiar el estado exigía dos clics
      // separados (uno para "Enviar" la observación, otro para "Guardar
      // cambios" del estado) — ahora un solo "Guardar cambios" hace ambos.
      if (hasPendingObservation) {
        await api.post(`/activities/${activity.id}/observations`, {
          observation: pendingObservation.trim(),
        });
        setPendingObservation('');
      }

      if (isManager && priorityState !== (deliverable.priority ?? activity.priority ?? 'media')) {
        await api.put(ENDPOINTS.DELIVERABLE(deliverable.id), {
          priority: priorityState
        });
      }

      await api.put(ENDPOINTS.ROLE_ACTIVITY(activity.id), {
        status,
        notes,
        production_not_applicable: allProductionNA,
        adjust_roles: selectedRolesToAdjust,
      });

      onStatusChange(activity.id, status);
      setSaved(true);
      setRefreshKey(k => k + 1);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e) {
      setStatus(activity.status);
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('requires_production') || msg.includes('registrar al menos un recurso')) {
        setSaveError(`Completa la sección ${prodStep} – Producción antes de marcar como Entregado.`);
      } else {
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
      // Sin auto-borrado: ahora que producción y evidencias se guardan antes
      // del cambio de estado, un error aquí es real y el usuario debe poder
      // leerlo. El mensaje se limpia al reintentar (setSaveError(null) arriba).
    }
    setSaving(false);
  }

  const TABS = [
    { id: 'principal' as const,  label: 'Actividad',        icon: GitCommitHorizontal },
    { id: 'evidencias' as const, label: 'Evidencias',       icon: Package },
    { id: 'timeline' as const,   label: 'Línea de tiempo',  icon: Clock },
  ];

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20" onClick={onClose}/>
      <div className="w-full sm:w-[420px] max-w-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col h-full border-l border-gray-200 dark:border-gray-700 text-left">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">{programName} › {subjectName}</p>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug">{deliverable.name ?? '—'}</h3>
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
                    ['Programa', programName],
                    ['Asignatura', subjectName],
                    ['Semana / Módulo', deliverable.name ?? '—'],
                    ...(deliverable.type ? [['Tipo', DELIVERABLE_TYPE_LABELS[deliverable.type as DeliverableType] ?? deliverable.type]] : []),
                    ...(deliverable.semestre ? [['Semestre', deliverable.semestre]] : []),
                    ...(deliverable.ciclo    ? [['Ciclo',    deliverable.ciclo]]    : []),
                    ['Fecha límite', activity.commitment_date ? formatDate(activity.commitment_date) : '—'],
                    ...(activity.actual_delivery_date ? [['Entregado el', formatDate(activity.actual_delivery_date)]] : []),
                    ...(activity.first_delivered_at && activity.actual_delivery_date && activity.first_delivered_at !== activity.actual_delivery_date
                      ? [['1ª entrega', formatDate(activity.first_delivered_at)]] : []),
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Estado</p>
                    <select value={status} onChange={e => setStatus(e.target.value)} disabled={isReadOnly}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700">
                      {roleStates.map(s => <option key={s} value={s}>{ROLE_STATUS_LABELS[s] ?? s}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Prioridad</p>
                    <div className="flex items-center gap-2">
                      {isManager ? (
                        <select value={priorityState} onChange={e => setPriorityState(e.target.value)} disabled={isReadOnly}
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700">
                          <option value="baja">Baja</option>
                          <option value="media">Media</option>
                          <option value="alta">Alta</option>
                        </select>
                      ) : (
                        <span className="flex-1 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {priorityState === 'alta' ? 'Alta' : priorityState === 'baja' ? 'Baja' : 'Media'}
                        </span>
                      )}
                      <span className={clsx('w-3.5 h-3.5 rounded-full flex-shrink-0 border border-black/10 dark:border-white/10 shadow-sm inline-block transition-all duration-300',
                        priorityState === 'alta' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                        priorityState === 'baja' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                      )}/>
                    </div>
                  </div>
                </div>

                {activity.role === 'qa' && ['adjustments_requested', 'with_findings'].includes(status) && adjustableRoles.length > 0 && (
                  <div className="mt-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">Selecciona los roles que requieren realizar ajustes:</p>
                    <div className="space-y-1.5">
                      {adjustableRoles.map(r => {
                        const isChecked = selectedRolesToAdjust.includes(r.role);
                        return (
                          <label key={r.role} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedRolesToAdjust(prev =>
                                  isChecked ? prev.filter(x => x !== r.role) : [...prev, r.role]
                                );
                              }}
                              className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
                            />
                            <span>{ROLE_LABELS[r.role as Role] ?? r.role} {r.responsible ? `(${r.responsible.name})` : ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
                  <ObservationsPanel
                    activityId={activity.id}
                    pendingText={pendingObservation}
                    setPendingText={setPendingObservation}
                    refreshKey={refreshKey}
                  />
                </div>
              </div>

              {/* ── Paso 2: Producción (solo roles productivos) ── */}
              {isProdRole && status !== 'not_applicable' && (
                <div className="px-4 py-3 space-y-2.5">
                  <StepHeader step={2} label="Producción" done={hasProduction || allProductionNA}/>
                  <div className="mt-1">
                    <QuickProductionGrid
                      activityId={activity.id}
                      role={activity.role}
                      quantities={quantities}
                      onQuantityChange={(id, qty) => setQuantities(q => ({ ...q, [id]: qty }))}
                      date={prodDate}
                      onDateChange={setProdDate}
                      onLogsLoaded={setExistingLogsCount}
                      refreshKey={refreshKey}
                      naResources={naResources}
                      onNAResourcesChange={setNaResources}
                      onResourceTypesLoaded={setTotalResourceTypes}
                      complexities={complexities}
                      onComplexityChange={(id, lvl) => setComplexities(c => ({ ...c, [id]: lvl }))}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              )}

              {/* ── Paso 2 o 3: Enlace de entrega ── */}
              {status !== 'not_applicable' && (
                <div className="px-4 py-3 space-y-2.5">
                  <StepHeader step={linkStep} label="Enlace de entrega" done={hasLink}/>
                  <div className="mt-1">
                    <EvidenceLinksPanel
                      activityId={activity.id}
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
              )}

            </div>
          )}

          {tab === 'evidencias' && (
            <div className="p-5">
              <EvidenciasTab deliverableId={deliverable.id} />
            </div>
          )}

          {tab === 'timeline' && (
            <div className="p-5">
              <TimelineView activityId={activity.id} />
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
