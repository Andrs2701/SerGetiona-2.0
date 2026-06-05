'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Paperclip, X, Clock, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { Workspace, WorkspaceActivity } from '@/lib/types';
import { MOCK_WORKSPACE } from '@/lib/mock-data';
import { ROLE_LABELS, ROLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';
import DateStatusBadge from '@/components/DateStatusBadge';

const DATE_STATUS_SORT: Record<string, number> = {
  overdue: 0,
  approaching: 1,
  on_time: 2,
  completed: 3,
  not_applicable: 4,
};

// Role-specific status options (Task 7)
const ROLE_STATES: Record<string, string[]> = {
  expert:      ['not_started', 'draft', 'in_development', 'delivered', 'adjustments_requested', 'approved', 'not_applicable'],
  pedagogy:    ['not_started', 'in_progress', 'in_review', 'adjusting', 'approved', 'not_applicable'],
  design:      ['not_started', 'designing', 'adjusting', 'approved', 'not_applicable'],
  audiovisual: ['not_started', 'production', 'editing', 'approved', 'not_applicable'],
  engineering: ['not_started', 'implementing', 'validating', 'approved', 'not_applicable'],
  qa:          ['pending', 'in_testing', 'with_findings', 'approved', 'not_applicable'],
};

type DateFilterType = '' | 'overdue' | 'approaching' | 'completed';

interface SidePanelProps {
  activity: WorkspaceActivity;
  onClose: () => void;
}

function ActivitySidePanel({ activity, onClose }: SidePanelProps) {
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState(activity.status);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const roleStates = ROLE_STATES[activity.role] ?? Object.keys(ROLE_STATUS_LABELS);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(ENDPOINTS.ROLE_ACTIVITY(activity.id), { status, notes: comment });
    } catch {
      // ignore — use mock
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 text-sm truncate pr-4">{activity.deliverable.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Info */}
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Proyecto</p>
              <p className="text-sm font-medium text-gray-900">{activity.project.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Programa</p>
              <p className="text-sm text-gray-700">{activity.program.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Asignatura</p>
              <p className="text-sm text-gray-700">{activity.subject.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Tipo</p>
              <p className="text-sm text-gray-700">{DELIVERABLE_TYPE_LABELS[activity.deliverable.type]}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Fecha compromiso</p>
              <p className="text-sm text-gray-700">
                {activity.commitment_date
                  ? new Date(activity.commitment_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Indicador</p>
              <DateStatusBadge date_status={activity.date_status} commitment_date={activity.commitment_date} />
            </div>
          </div>

          {/* Change status — role-specific options */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado actual</p>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            >
              {roleStates.map((s) => (
                <option key={s} value={s}>
                  {ROLE_STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </div>

          {/* Comment */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agregar comentario</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Escribe una nota o comentario..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Attach evidence */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adjuntar evidencia</p>
            <input ref={fileRef} type="file" className="hidden" multiple />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-full justify-center"
            >
              <Paperclip size={14} />
              Seleccionar archivos
            </button>
          </div>

          {/* Mock comment history */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Historial de comentarios</p>
            {[
              { user: 'Ana Rodríguez', comment: 'Revisar la estructura de contenidos antes de enviar.', time: 'Hace 2 días' },
              { user: 'Carlos Méndez', comment: 'Aprobado en primera revisión. Pendiente ajuste menor.', time: 'Hace 5 días' },
            ].map((c, i) => (
              <div key={i} className="flex gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {c.user[0]}
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                  <p className="text-xs font-medium text-gray-800">{c.user}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{c.comment}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{c.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 px-5 py-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MiEspacioPage() {
  const { user } = useAuthContext();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('');
  const [filterProject, setFilterProject] = useState('');
  const [selected, setSelected] = useState<WorkspaceActivity | null>(null);

  useEffect(() => {
    api
      .get<Workspace>(ENDPOINTS.MY_WORKSPACE)
      .then(setWorkspace)
      .catch(() => setWorkspace(MOCK_WORKSPACE))
      .finally(() => setLoading(false));
  }, []);

  const data = workspace ?? MOCK_WORKSPACE;

  const projects = [...new Set(data.activities.map((a) => a.project.name))];

  const filtered = data.activities
    .filter((act) => {
      const matchSearch =
        !search ||
        act.deliverable.name.toLowerCase().includes(search.toLowerCase()) ||
        act.subject.name.toLowerCase().includes(search.toLowerCase()) ||
        act.project.name.toLowerCase().includes(search.toLowerCase());

      let matchDate = true;
      if (dateFilter === 'overdue') matchDate = act.date_status === 'overdue';
      else if (dateFilter === 'approaching') matchDate = act.date_status === 'approaching';
      else if (dateFilter === 'completed') matchDate = act.date_status === 'completed' || act.status === 'approved';

      const matchProject = !filterProject || act.project.name === filterProject;
      return matchSearch && matchDate && matchProject;
    })
    .sort(
      (a, b) =>
        (DATE_STATUS_SORT[a.date_status] ?? 9) - (DATE_STATUS_SORT[b.date_status] ?? 9)
    );

  const statCards = [
    { label: 'Pendientes', value: data.stats.pending, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', filter: '' as DateFilterType },
    { label: 'Próx. a vencer', value: data.stats.approaching, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', filter: 'approaching' as DateFilterType },
    { label: 'Vencidas', value: data.stats.overdue, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', filter: 'overdue' as DateFilterType },
    { label: 'Completadas', value: data.stats.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', filter: 'completed' as DateFilterType },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      {selected && <ActivitySidePanel activity={selected} onClose={() => setSelected(null)} />}

      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Mi Espacio — {user ? (ROLE_LABELS as Record<string, string>)[user.role] ?? user.role : 'Operativo'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Tus actividades asignadas y su estado</p>
        </div>

        {/* Stats — clickable filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg, filter }) => (
            <button
              key={label}
              onClick={() => setDateFilter((prev) => (prev === filter ? '' : filter))}
              className={clsx(
                'bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 text-left transition-colors hover:border-gray-300',
                dateFilter === filter && filter !== '' && 'ring-2 ring-indigo-400 border-indigo-300'
              )}
            >
              <div className={`${bg} rounded-lg p-2.5`}>
                <Icon className={`${color} w-5 h-5`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Quick filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {([
            { label: 'Todos', value: '' },
            { label: 'Vencidos', value: 'overdue' },
            { label: 'Por Vencer', value: 'approaching' },
            { label: 'Completados', value: 'completed' },
          ] as { label: string; value: DateFilterType }[]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setDateFilter(tab.value)}
              className={clsx(
                'px-3 py-1 text-sm rounded-full border transition-colors',
                dateFilter === tab.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
          >
            <option value="">Todos los proyectos</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {(search || dateFilter || filterProject) && (
            <button
              onClick={() => { setSearch(''); setDateFilter(''); setFilterProject(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Table — all columns (Task 8) */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Asignatura</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entregable</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">T. Contenido</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">F. Compromiso</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Indicador</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((act) => (
                  <tr key={act.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-700 truncate max-w-[130px]" title={act.project.name}>{act.project.name}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]" title={act.subject.name}>{act.subject.name}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[160px]" title={act.deliverable.name}>{act.deliverable.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{DELIVERABLE_TYPE_LABELS[act.deliverable.type]}</td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        'bg-gray-100 text-gray-700'
                      )}>
                        {ROLE_STATUS_LABELS[act.status] ?? act.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {act.commitment_date
                        ? new Date(act.commitment_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <DateStatusBadge date_status={act.date_status} show_date={false} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(act)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                      No se encontraron actividades con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
