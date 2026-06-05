'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, X, ChevronDown, ChevronUp,
  Clock, XCircle, CheckCircle2, AlertTriangle,
  CalendarDays, Link2, MessageSquare, GitCommitHorizontal,
  Send, Plus, Trash2, ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { Workspace, WorkspaceActivity, TimelineEvent, EvidenceLink } from '@/lib/types';
import { MOCK_WORKSPACE } from '@/lib/mock-data';
import {
  ROLE_LABELS, ROLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS,
} from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function daysDiff(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date + 'T00:00:00');
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

// Auto-status logic
function computeAutoStatus(act: WorkspaceActivity): { label: string; cls: string } {
  if (act.status === 'approved') {
    if (act.actual_delivery_date && act.commitment_date) {
      return act.actual_delivery_date <= act.commitment_date
        ? { label: 'Entregada a tiempo', cls: 'bg-emerald-100 text-emerald-700' }
        : { label: 'Entregada fuera de tiempo', cls: 'bg-amber-100 text-amber-700' };
    }
    return { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700' };
  }
  if (act.date_status === 'overdue') return { label: 'Vencida', cls: 'bg-red-100 text-red-700' };
  if (['adjustments_requested', 'with_findings'].includes(act.status))
    return { label: 'Devuelta', cls: 'bg-orange-100 text-orange-700' };
  if (['delivered', 'in_review', 'in_testing', 'validating'].includes(act.status))
    return { label: 'En Revisión', cls: 'bg-purple-100 text-purple-700' };
  if (['in_progress', 'in_development', 'designing', 'production', 'implementing', 'draft', 'editing', 'adjusting'].includes(act.status))
    return { label: 'En Proceso', cls: 'bg-blue-100 text-blue-700' };
  return { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' };
}

const ROLE_STATES: Record<string, string[]> = {
  expert:      ['not_started', 'draft', 'in_development', 'delivered', 'adjustments_requested', 'approved', 'not_applicable'],
  pedagogy:    ['not_started', 'in_progress', 'in_review', 'adjusting', 'approved', 'not_applicable'],
  design:      ['not_started', 'designing', 'adjusting', 'approved', 'not_applicable'],
  audiovisual: ['not_started', 'production', 'editing', 'approved', 'not_applicable'],
  engineering: ['not_started', 'implementing', 'validating', 'approved', 'not_applicable'],
  qa:          ['pending', 'in_testing', 'with_findings', 'approved', 'not_applicable'],
};

const DATE_STATUS_SORT: Record<string, number> = { overdue: 0, approaching: 1, on_time: 2, completed: 3, not_applicable: 4 };

// ─── Timeline ────────────────────────────────────────────────────────────────

const TIMELINE_COLORS: Record<string, string> = {
  created:      'bg-indigo-500',
  assigned:     'bg-sky-500',
  status:       'bg-blue-500',
  delivered:    'bg-teal-500',
  date_changed: 'bg-amber-400',
  note:         'bg-gray-400',
  approved:     'bg-emerald-500',
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

  if (loading) return <div className="py-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>;
  if (events.length === 0) return <p className="text-sm text-gray-400 py-4 text-center">Sin eventos registrados</p>;

  return (
    <div className="relative pl-5 space-y-4">
      {/* vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-100" />
      {events.map((ev, idx) => (
        <div key={idx} className="relative flex gap-3">
          <div className={`absolute -left-3 w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${TIMELINE_COLORS[ev.type] ?? 'bg-gray-400'}`} />
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

// ─── Evidence Links ───────────────────────────────────────────────────────────

function EvidenceLinksPanel({ activityId }: { activityId: number }) {
  const [links, setLinks] = useState<EvidenceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<EvidenceLink[]>(ENDPOINTS.ACTIVITY_EVIDENCE(activityId))
      .then(setLinks)
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, [activityId]);

  async function handleAdd() {
    if (!url.trim() || !title.trim()) return;
    setSaving(true);
    try {
      const newLink = await api.post<EvidenceLink>(ENDPOINTS.ACTIVITY_EVIDENCE(activityId), {
        type: 'url',
        title: title.trim(),
        url: url.trim(),
      });
      setLinks((prev) => [...prev, newLink as EvidenceLink]);
      setUrl(''); setTitle(''); setAdding(false);
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleDelete(linkId: number) {
    try {
      await api.delete(`/evidence/${linkId}`);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch { /* ignore */ }
  }

  if (loading) return <div className="h-12 bg-gray-50 rounded animate-pulse" />;

  return (
    <div className="space-y-2">
      {links.length === 0 && !adding && (
        <p className="text-xs text-gray-400">Sin enlaces adjuntos</p>
      )}

      {links.map((l) => (
        <div key={l.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <Link2 size={13} className="text-indigo-400 flex-shrink-0" />
          <a href={l.url} target="_blank" rel="noreferrer"
            className="flex-1 text-xs text-indigo-600 hover:underline truncate">
            {l.title || l.url}
          </a>
          <ExternalLink size={11} className="text-gray-300 flex-shrink-0" />
          <button onClick={() => handleDelete(l.id)}
            className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {adding && (
        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del enlace"
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 placeholder:text-gray-400" />
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 placeholder:text-gray-400" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !url.trim() || !title.trim()}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              <Send size={11} /> Guardar
            </button>
            <button onClick={() => { setAdding(false); setUrl(''); setTitle(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!adding && (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
          <Plus size={12} /> Agregar enlace
        </button>
      )}
    </div>
  );
}

// ─── Comments ────────────────────────────────────────────────────────────────

interface CommentItem { user: { name: string }; content: string; created_at: string }

function CommentsPanel({ deliverableId }: { deliverableId: number }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get<CommentItem[]>(ENDPOINTS.DELIVERABLE_COMMENTS(deliverableId))
      .then((r) => setComments(Array.isArray(r) ? r : []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [deliverableId]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const newComment = await api.post<CommentItem>(`/deliverables/${deliverableId}/comments`, { content: text.trim() });
      setComments((prev) => [...prev, newComment as CommentItem]);
      setText('');
    } catch { /* ignore */ }
    setSending(false);
  }

  if (loading) return <div className="h-16 bg-gray-50 rounded animate-pulse" />;

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {comments.length === 0 && <p className="text-xs text-gray-400">Sin comentarios aún</p>}
        {comments.map((c, i) => (
          <div key={i} className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {c.user?.name?.[0] ?? '?'}
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg p-2">
              <p className="text-xs font-medium text-gray-800">{c.user?.name}</p>
              <p className="text-xs text-gray-600 mt-0.5">{c.content}</p>
              <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(c.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Agregar comentario..."
          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-900 placeholder:text-gray-400" />
        <button onClick={handleSend} disabled={sending || !text.trim()}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

type CardTab = 'info' | 'enlace' | 'comentarios' | 'timeline';

function ActivityCard({ act, onStatusChange }: {
  act: WorkspaceActivity;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<CardTab>('info');
  const [status, setStatus] = useState(act.status);
  const [notes, setNotes] = useState(act.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const autoStatus = computeAutoStatus({ ...act, status });
  const roleStates = ROLE_STATES[act.role] ?? Object.keys(ROLE_STATUS_LABELS);

  const daysInfo = act.commitment_date ? (() => {
    const d = daysDiff(act.commitment_date!);
    if (d < 0) return { text: `Vencida hace ${Math.abs(d)}d`, cls: 'text-red-600 font-semibold' };
    if (d === 0) return { text: 'Vence hoy', cls: 'text-amber-600 font-semibold' };
    if (d <= 5) return { text: `Vence en ${d}d`, cls: 'text-amber-500' };
    return { text: formatDate(act.commitment_date!), cls: 'text-gray-500' };
  })() : null;

  const borderColor =
    act.date_status === 'overdue' ? 'border-l-red-400' :
    act.date_status === 'approaching' ? 'border-l-amber-400' :
    act.status === 'approved' ? 'border-l-emerald-400' :
    'border-l-indigo-200';

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(ENDPOINTS.ROLE_ACTIVITY(act.id), { status, notes });
      onStatusChange(act.id, status);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* optimistic */ }
    setSaving(false);
  }

  const TABS: { id: CardTab; label: string; icon: React.ElementType }[] = [
    { id: 'info',        label: 'Información',  icon: GitCommitHorizontal },
    { id: 'enlace',      label: 'Enlace',        icon: Link2 },
    { id: 'comentarios', label: 'Comentarios',  icon: MessageSquare },
    { id: 'timeline',    label: 'Línea de tiempo', icon: Clock },
  ];

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColor} overflow-hidden transition-shadow ${expanded ? 'shadow-md' : 'hover:shadow-sm'}`}>
      {/* Collapsed header */}
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex-1 min-w-0">
          {/* Row 1: Urgency + deliverable name */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${autoStatus.cls}`}>
              {autoStatus.label}
            </span>
            <span className="text-xs text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5 font-medium">
              {DELIVERABLE_TYPE_LABELS[act.deliverable.type]}
            </span>
          </div>
          {/* Row 2: Deliverable name */}
          <p className="text-sm font-semibold text-gray-900 truncate">{act.deliverable.name}</p>
          {/* Row 3: Program > Subject */}
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {act.program.name} › {act.subject.name}
          </p>
          {/* Row 4: Date info */}
          {daysInfo && (
            <div className="flex items-center gap-1 mt-1.5 text-xs">
              <CalendarDays size={11} className="text-gray-400" />
              <span className={daysInfo.cls}>{daysInfo.text}</span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 mt-1 text-gray-400">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
                  tab === id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* INFO tab */}
            {tab === 'info' && (
              <div className="space-y-4">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <p className="text-gray-400 mb-0.5">Programa</p>
                    <p className="font-medium text-gray-800">{act.program.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Asignatura</p>
                    <p className="font-medium text-gray-800">{act.subject.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Semana / Módulo</p>
                    <p className="font-medium text-gray-800">{act.deliverable.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Tipo</p>
                    <p className="font-medium text-gray-800">{DELIVERABLE_TYPE_LABELS[act.deliverable.type]}</p>
                  </div>
                  {act.deliverable.semestre && (
                    <div>
                      <p className="text-gray-400 mb-0.5">Semestre</p>
                      <p className="font-medium text-gray-800">{act.deliverable.semestre}</p>
                    </div>
                  )}
                  {act.deliverable.ciclo && (
                    <div>
                      <p className="text-gray-400 mb-0.5">Ciclo</p>
                      <p className="font-medium text-gray-800">{act.deliverable.ciclo}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400 mb-0.5">Fecha de entrega</p>
                    <p className="font-medium text-gray-800">
                      {act.commitment_date ? formatDate(act.commitment_date) : '—'}
                    </p>
                  </div>
                  {act.actual_delivery_date && (
                    <div>
                      <p className="text-gray-400 mb-0.5">Entregado el</p>
                      <p className="font-medium text-gray-800">{formatDate(act.actual_delivery_date)}</p>
                    </div>
                  )}
                </div>

                {/* Estado selector */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Estado</p>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 bg-white">
                    {roleStates.map((s) => (
                      <option key={s} value={s}>{ROLE_STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </div>

                {/* Observaciones */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Observaciones</p>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={2} placeholder="Notas u observaciones..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none text-gray-900 placeholder:text-gray-400" />
                </div>

                {/* Save */}
                <button onClick={handleSave} disabled={saving}
                  className={clsx(
                    'w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                    saved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700',
                    saving && 'opacity-60'
                  )}>
                  {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
                </button>
              </div>
            )}

            {/* ENLACE tab */}
            {tab === 'enlace' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-3">Agrega los enlaces de entrega (Google Drive, SharePoint, repositorio, etc.)</p>
                <EvidenceLinksPanel activityId={act.id} />
              </div>
            )}

            {/* COMENTARIOS tab */}
            {tab === 'comentarios' && <CommentsPanel deliverableId={act.deliverable.id} />}

            {/* TIMELINE tab */}
            {tab === 'timeline' && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Historial de cambios</p>
                <TimelineView activityId={act.id} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type QuickFilter = '' | 'overdue' | 'approaching' | 'completed' | 'pending';

export default function MiEspacioPage() {
  const { user } = useAuthContext();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);

  useEffect(() => {
    api.get<Workspace>(ENDPOINTS.MY_WORKSPACE)
      .then((ws) => { setWorkspace(ws); setActivities(ws.activities ?? []); })
      .catch(() => { setWorkspace(MOCK_WORKSPACE); setActivities(MOCK_WORKSPACE.activities ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = useCallback((id: number, status: string) => {
    setActivities((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  }, []);

  // KPI counts
  const total     = activities.length;
  const pending   = activities.filter((a) => ['not_started', 'pending'].includes(a.status)).length;
  const overdue   = activities.filter((a) => a.date_status === 'overdue' && a.status !== 'approved').length;
  const approaching = activities.filter((a) => a.date_status === 'approaching' && a.status !== 'approved').length;
  const completed = activities.filter((a) => a.status === 'approved').length;

  const filtered = activities
    .filter((a) => {
      const matchSearch = !search ||
        a.deliverable.name.toLowerCase().includes(search.toLowerCase()) ||
        a.subject.name.toLowerCase().includes(search.toLowerCase()) ||
        a.program.name.toLowerCase().includes(search.toLowerCase());

      let matchFilter = true;
      if (quickFilter === 'overdue')    matchFilter = a.date_status === 'overdue';
      else if (quickFilter === 'approaching') matchFilter = a.date_status === 'approaching';
      else if (quickFilter === 'completed')   matchFilter = a.status === 'approved';
      else if (quickFilter === 'pending') matchFilter = ['not_started', 'pending'].includes(a.status);

      return matchSearch && matchFilter;
    })
    .sort((a, b) => (DATE_STATUS_SORT[a.date_status] ?? 9) - (DATE_STATUS_SORT[b.date_status] ?? 9));

  const roleLabel = user ? (ROLE_LABELS as Record<string, string>)[user.role] ?? user.role : '';

  const quickFilters: { id: QuickFilter; label: string; count: number; icon: React.ElementType; cls: string }[] = [
    { id: '', label: 'Todas', count: total, icon: Clock, cls: '' },
    { id: 'pending', label: 'Pendientes', count: pending, icon: Clock, cls: 'text-gray-600' },
    { id: 'overdue', label: 'Vencidas', count: overdue, icon: XCircle, cls: 'text-red-600' },
    { id: 'approaching', label: 'Por vencer', count: approaching, icon: AlertTriangle, cls: 'text-amber-600' },
    { id: 'completed', label: 'Completadas', count: completed, icon: CheckCircle2, cls: 'text-emerald-600' },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-20" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Espacio de Trabajo</h1>
        <p className="text-sm text-gray-500 mt-0.5">{roleLabel} — {total} actividades asignadas</p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Quick filter chips */}
        <div className="flex flex-wrap gap-2">
          {quickFilters.map(({ id, label, count, icon: Icon, cls }) => (
            <button key={id}
              onClick={() => setQuickFilter(id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                quickFilter === id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              )}>
              <Icon size={12} className={quickFilter === id ? '' : cls} />
              {label}
              <span className={clsx(
                'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                quickFilter === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 placeholder:text-gray-400" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Activity cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          No hay actividades con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((act) => (
            <ActivityCard key={act.id} act={act} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
