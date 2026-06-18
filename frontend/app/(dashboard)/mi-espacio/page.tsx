'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, X, ChevronDown, ChevronUp, ChevronRight,
  Clock, XCircle, CheckCircle2, AlertTriangle,
  CalendarDays, Link2, MessageSquare, GitCommitHorizontal,
  Send, Plus, Trash2, ExternalLink, Filter,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { Workspace, WorkspaceActivity, TimelineEvent, EvidenceLink } from '@/lib/types';
import { ROLE_LABELS, ROLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';

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
const MANAGER_ONLY_STATUSES = ['approved', 'not_applicable'];

const ROLE_STATES: Record<string, string[]> = {
  expert:      ['not_started','draft','in_development','delivered','adjustments_requested','approved','not_applicable'],
  pedagogy:    ['not_started','in_progress','in_review','adjusting','delivered','approved','not_applicable'],
  design:      ['not_started','designing','adjusting','delivered','approved','not_applicable'],
  audiovisual: ['not_started','production','editing','delivered','approved','not_applicable'],
  engineering: ['not_started','implementing','validating','delivered','approved','not_applicable'],
  qa:          ['pending','in_testing','with_findings','approved','not_applicable'],
};

// ─── Detail Panel tabs ────────────────────────────────────────────────────────

type PanelTab = 'info' | 'enlace' | 'comentarios' | 'timeline';

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

// Evidence links
function EvidenceLinksPanel({ activityId }: { activityId: number }) {
  const [links, setLinks] = useState<EvidenceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<EvidenceLink[]>(ENDPOINTS.ACTIVITY_EVIDENCE(activityId))
      .then(setLinks).catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, [activityId]);

  async function handleAdd() {
    if (!url.trim() || !title.trim()) return;
    setSaving(true);
    try {
      const l = await api.post<EvidenceLink>(ENDPOINTS.ACTIVITY_EVIDENCE(activityId), { type: 'url', title: title.trim(), url: url.trim() });
      setLinks(p => [...p, l as EvidenceLink]);
      setUrl(''); setTitle(''); setAdding(false);
    } catch { /* ignore */ }
    setSaving(false);
  }

  if (loading) return <div className="h-10 bg-gray-50 rounded animate-pulse"/>;

  return (
    <div className="space-y-2">
      {!links.length && !adding && <p className="text-xs text-gray-400">Sin enlaces adjuntos</p>}
      {links.map((l) => (
        <div key={l.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <Link2 size={13} className="text-indigo-400 flex-shrink-0"/>
          <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-xs text-indigo-600 hover:underline truncate">{l.title || l.url}</a>
          <ExternalLink size={11} className="text-gray-300 flex-shrink-0"/>
          <button onClick={async () => { await api.delete(`/evidence/${l.id}`); setLinks(p => p.filter(x => x.id !== l.id)); }} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={12}/></button>
        </div>
      ))}
      {adding && (
        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del enlace"
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 placeholder:text-gray-400"/>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 placeholder:text-gray-400"/>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !url.trim() || !title.trim()}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              <Send size={11}/> Guardar
            </button>
            <button onClick={() => { setAdding(false); setUrl(''); setTitle(''); }} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancelar</button>
          </div>
        </div>
      )}
      {!adding && (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
          <Plus size={12}/> Agregar enlace
        </button>
      )}
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

// ─── Detail side panel ────────────────────────────────────────────────────────

function DetailPanel({
  act,
  onClose,
  onStatusChange,
  isManager,
  onSaved,
}: {
  act: WorkspaceActivity;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
  isManager: boolean;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<PanelTab>('info');
  const [status, setStatus] = useState(act.status);
  const [notes, setNotes] = useState(act.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync local state when a different activity is selected
  useEffect(() => {
    setStatus(act.status);
    setNotes(act.notes ?? '');
    setSaved(false);
    setSaveError(null);
  }, [act.id]);

  const allStates = ROLE_STATES[act.role] ?? Object.keys(ROLE_STATUS_LABELS);
  const roleStates = isManager
    ? allStates
    : allStates.filter(s => !MANAGER_ONLY_STATUSES.includes(s));

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.put(ENDPOINTS.ROLE_ACTIVITY(act.id), { status, notes });
      onStatusChange(act.id, status);   // optimistic update
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();                         // re-fetch from server so all users see fresh data
    } catch {
      setStatus(act.status);
      setSaveError('No se pudo guardar. Verifica tus permisos e intenta de nuevo.');
      setTimeout(() => setSaveError(null), 4000);
    }
    setSaving(false);
  }

  const TABS: { id: PanelTab; label: string; icon: React.ElementType }[] = [
    { id: 'info',        label: 'Información',     icon: GitCommitHorizontal },
    { id: 'enlace',      label: 'Enlace',           icon: Link2 },
    { id: 'comentarios', label: 'Comentarios',      icon: MessageSquare },
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
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
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
                    <p className="text-gray-400 mb-0.5">{label}</p>
                    <p className="font-medium text-gray-800">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Estado</p>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 bg-white">
                  {roleStates.map(s => <option key={s} value={s}>{ROLE_STATUS_LABELS[s] ?? s}</option>)}
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Observaciones</p>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Notas u observaciones..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none text-gray-900 placeholder:text-gray-400"/>
              </div>

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}
              <button onClick={handleSave} disabled={saving}
                className={clsx('w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                  saved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700',
                  saving && 'opacity-60')}>
                {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
              </button>
            </div>
          )}
          {tab === 'enlace'      && <><p className="text-xs text-gray-500 mb-3">Agrega enlaces de entrega (Drive, SharePoint, repositorio, etc.)</p><EvidenceLinksPanel activityId={act.id}/></>}
          {tab === 'comentarios' && act.deliverable && <CommentsPanel deliverableId={act.deliverable.id}/>}
          {tab === 'timeline'    && <><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Historial de cambios</p><TimelineView activityId={act.id}/></>}
        </div>
      </div>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function ActivityRow({
  act,
  onSelect,
  selected,
}: {
  act: WorkspaceActivity;
  onSelect: (a: WorkspaceActivity) => void;
  selected: boolean;
}) {
  const autoStatus = computeAutoStatus(act);
  const daysLeft = act.commitment_date ? daysDiff(act.commitment_date) : null;

  const rowBg = selected
    ? 'bg-indigo-50'
    : act.date_status === 'overdue'
    ? 'bg-red-50/40 hover:bg-red-50/70'
    : act.date_status === 'approaching'
    ? 'bg-amber-50/40 hover:bg-amber-50/70'
    : 'hover:bg-gray-50/70';

  return (
    <tr
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
}: {
  programName: string;
  activities: WorkspaceActivity[];
  onSelect: (a: WorkspaceActivity) => void;
  selectedId: number | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

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
        <ActivityRow key={act.id} act={act} onSelect={onSelect} selected={selectedId === act.id}/>
      ))}
    </tbody>
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

  // Filters
  const [search, setSearch]               = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus]   = useState<StatusFilter>('');
  const [showCompleted, setShowCompleted] = useState(false);

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

  // Optimistic local update + schedule a server sync
  const handleStatusChange = useCallback((id: number, status: string) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setSelectedAct(prev => prev?.id === id ? { ...prev, status } : prev);
  }, []);

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
      if ((a.program?.name ?? '') !== (b.program?.name ?? '')) return (a.program?.name ?? '').localeCompare(b.program?.name ?? '');
      if ((a.subject?.name ?? '') !== (b.subject?.name ?? '')) return (a.subject?.name ?? '').localeCompare(b.subject?.name ?? '');
      return (DATE_STATUS_SORT[a.date_status] ?? 9) - (DATE_STATUS_SORT[b.date_status] ?? 9);
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
        <DetailPanel act={selectedAct} onClose={() => setSelectedAct(null)} onStatusChange={handleStatusChange} isManager={isManager} onSaved={loadWorkspace}/>
      )}

      <div className="p-4 sm:p-6 space-y-5">
        {/* Heading */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Espacio de Trabajo</h1>
          <p className="text-sm text-gray-500 mt-0.5">{roleLabel} · {total} actividades asignadas</p>
        </div>

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
    </>
  );
}
