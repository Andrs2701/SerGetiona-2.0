'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, ClipboardList, Info, CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { DecisionRecord, DecisionStatus, DecisionImpact, Project, User } from '@/lib/types';
import { DECISION_STATUS_LABELS, DECISION_IMPACT_LABELS } from '@/lib/types';
import Modal from '@/components/Modal';
import { StatsSkeleton } from '@/components/LoadingSkeleton';

// ── color maps ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<DecisionStatus, string> = {
  pending:     'bg-amber-50 text-amber-700 border border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border border-blue-200',
  implemented: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled:   'bg-gray-50 text-gray-500 border border-gray-200',
};

const STATUS_ICONS: Record<DecisionStatus, React.ElementType> = {
  pending:     Clock,
  in_progress: AlertCircle,
  implemented: CheckCircle2,
  cancelled:   XCircle,
};

const IMPACT_COLORS: Record<DecisionImpact, string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-orange-100 text-orange-700',
  high:   'bg-red-100 text-red-700',
};

const IMPACT_DOT: Record<DecisionImpact, string> = {
  low:    'bg-gray-400',
  medium: 'bg-orange-400',
  high:   'bg-red-500',
};

const STATUSES: DecisionStatus[] = ['pending', 'in_progress', 'implemented', 'cancelled'];
const IMPACTS:  DecisionImpact[] = ['low', 'medium', 'high'];

// ── stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={clsx('rounded-xl border px-5 py-4', color)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-75">{label}</p>
    </div>
  );
}

// ── form types ────────────────────────────────────────────────────────────────
interface DecisionForm {
  decision_date: string;
  description: string;
  project_id: string;
  responsible_id: string;
  status: DecisionStatus;
  impact: DecisionImpact;
  observations: string;
}

const emptyForm: DecisionForm = {
  decision_date: new Date().toISOString().split('T')[0],
  description: '',
  project_id: '',
  responsible_id: '',
  status: 'pending',
  impact: 'medium',
  observations: '',
};

// ── main component ────────────────────────────────────────────────────────────
export default function DecisionesPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';

  const [records, setRecords]         = useState<DecisionRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<DecisionRecord | null>(null);
  const [form, setForm]               = useState<DecisionForm>(emptyForm);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');

  const [projects, setProjects]       = useState<Project[]>([]);
  const [users, setUsers]             = useState<User[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const res = await api.get<{ decisions: DecisionRecord[] }>(`/decisions${params}`);
      setRecords(res.decisions ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isManager) return;
    Promise.all([
      api.get<unknown>('/projects').catch(() => ({ data: [] })),
      api.get<unknown>('/users').catch(() => ({ data: [] })),
    ]).then(([pRes, uRes]) => {
      const pArr = Array.isArray(pRes) ? pRes : (pRes as { data?: Project[] }).data ?? [];
      const uArr = Array.isArray(uRes) ? uRes : (uRes as { data?: User[] }).data ?? [];
      setProjects(pArr as Project[]);
      setUsers(uArr as User[]);
    });
  }, [isManager]);

  const filtered = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.description.toLowerCase().includes(q) ||
      r.project?.name?.toLowerCase().includes(q) ||
      r.responsible?.name?.toLowerCase().includes(q)
    );
  });

  // Stats
  const stats = {
    total:       records.length,
    pending:     records.filter((r) => r.status === 'pending').length,
    in_progress: records.filter((r) => r.status === 'in_progress').length,
    implemented: records.filter((r) => r.status === 'implemented').length,
    high_impact: records.filter((r) => r.impact === 'high').length,
  };

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(rec: DecisionRecord) {
    setEditing(rec);
    setForm({
      decision_date:  rec.decision_date,
      description:    rec.description,
      project_id:     rec.project_id    ? String(rec.project_id)    : '',
      responsible_id: rec.responsible_id? String(rec.responsible_id): '',
      status:         rec.status,
      impact:         rec.impact,
      observations:   rec.observations ?? '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.description.trim() || !form.decision_date) {
      setFormError('Fecha y descripción son obligatorias.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        decision_date:  form.decision_date,
        description:    form.description.trim(),
        project_id:     form.project_id     ? Number(form.project_id)     : null,
        responsible_id: form.responsible_id ? Number(form.responsible_id) : null,
        status:         form.status,
        impact:         form.impact,
        observations:   form.observations.trim() || null,
      };
      if (editing) {
        await api.put(`/decisions/${editing.id}`, payload);
      } else {
        await api.post('/decisions', payload);
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rec: DecisionRecord) {
    if (!confirm(`¿Eliminar "${rec.description.slice(0, 60)}…"?`)) return;
    await api.delete(`/decisions/${rec.id}`).catch(() => alert('No se pudo eliminar.'));
    load();
  }

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
        <ClipboardList size={40} />
        <p className="text-sm">Acceso restringido a administradores y coordinadores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registro de Decisiones</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Seguimiento de decisiones clave del equipo de producción académica
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Nueva Decisión
        </button>
      </div>

      {/* ── Explicación contextual ── */}
      <div className="flex gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4">
        <Info size={18} className="text-indigo-500 flex-none mt-0.5" />
        <div className="text-sm text-indigo-800 space-y-1">
          <p className="font-semibold">¿Para qué sirve este módulo?</p>
          <p className="text-indigo-700 leading-relaxed">
            Centraliza las decisiones estratégicas y operativas que afectan la producción de contenido:
            cambios de metodología, prioridades de entrega, restricciones técnicas, redistribución de
            carga o acuerdos con el cliente. Cada decisión queda trazada con fecha, responsable, nivel
            de impacto y estado de implementación, creando un historial auditable para el equipo y la dirección.
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total decisiones"   value={stats.total}       color="bg-white border-gray-200 text-gray-800" />
        <StatCard label="Pendientes"         value={stats.pending}     color="bg-amber-50 border-amber-200 text-amber-700" />
        <StatCard label="En progreso"        value={stats.in_progress} color="bg-blue-50 border-blue-200 text-blue-700" />
        <StatCard label="Impacto alto"       value={stats.high_impact} color="bg-red-50 border-red-200 text-red-700" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por descripción, proyecto o responsable…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['', ...STATUSES] as ('' | DecisionStatus)[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={clsx(
                'px-3 py-2 rounded-lg text-xs font-medium transition-colors border',
                filterStatus === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              )}
            >
              {s === '' ? 'Todos' : DECISION_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6"><StatsSkeleton /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
            <ClipboardList size={40} />
            <p className="text-sm font-medium">No hay decisiones registradas.</p>
            <button
              onClick={openNew}
              className="mt-2 text-sm text-indigo-600 hover:underline font-medium"
            >
              + Registrar primera decisión
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 w-28">Fecha</th>
                <th className="px-5 py-3">Decisión</th>
                <th className="px-5 py-3 w-36 hidden md:table-cell">Proyecto</th>
                <th className="px-5 py-3 w-36 hidden lg:table-cell">Responsable</th>
                <th className="px-5 py-3 w-36">Estado</th>
                <th className="px-5 py-3 w-24">Impacto</th>
                <th className="px-5 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((rec) => {
                const StatusIcon = STATUS_ICONS[rec.status];
                return (
                  <tr key={rec.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-5 py-4 whitespace-nowrap text-gray-500 text-xs">
                      {new Date(rec.decision_date + 'T12:00:00').toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <p className="text-gray-900 font-medium leading-snug line-clamp-2" title={rec.description}>
                        {rec.description}
                      </p>
                      {rec.observations && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate" title={rec.observations}>
                          {rec.observations}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      {rec.project?.name
                        ? <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5">{rec.project.name}</span>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-gray-600 text-xs">
                      {rec.responsible?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        STATUS_COLORS[rec.status]
                      )}>
                        <StatusIcon size={11} />
                        {DECISION_STATUS_LABELS[rec.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        IMPACT_COLORS[rec.impact]
                      )}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', IMPACT_DOT[rec.impact])} />
                        {DECISION_IMPACT_LABELS[rec.impact]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(rec)}
                          className="text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(rec)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {filtered.length} de {records.length} decisión{records.length !== 1 ? 'es' : ''}
        </p>
      )}

      {/* ── Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Decisión' : 'Nueva Decisión'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear decisión'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha *</label>
              <input
                type="date"
                value={form.decision_date}
                onChange={(e) => setForm((f) => ({ ...f, decision_date: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Proyecto</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Sin proyecto específico</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción de la decisión *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="¿Qué se decidió y por qué?"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Responsable</label>
              <select
                value={form.responsible_id}
                onChange={(e) => setForm((f) => ({ ...f, responsible_id: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Sin asignar</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DecisionStatus }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{DECISION_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Impacto</label>
              <select
                value={form.impact}
                onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value as DecisionImpact }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {IMPACTS.map((i) => <option key={i} value={i}>{DECISION_IMPACT_LABELS[i]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observaciones / contexto adicional</label>
            <textarea
              value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Detalles, fecha límite de implementación, dependencias…"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
