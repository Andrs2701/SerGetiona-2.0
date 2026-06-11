'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, ClipboardList } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { DecisionRecord, DecisionStatus, DecisionImpact, Project, User } from '@/lib/types';
import { DECISION_STATUS_LABELS, DECISION_IMPACT_LABELS } from '@/lib/types';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { StatsSkeleton } from '@/components/LoadingSkeleton';

// ── color maps ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<DecisionStatus, string> = {
  pending:     'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  implemented: 'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-gray-100 text-gray-500',
};

const IMPACT_COLORS: Record<DecisionImpact, string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-orange-100 text-orange-700',
  high:   'bg-red-100 text-red-700',
};

const STATUSES: DecisionStatus[]  = ['pending', 'in_progress', 'implemented', 'cancelled'];
const IMPACTS:  DecisionImpact[]  = ['low', 'medium', 'high'];

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

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}>
      {label}
    </span>
  );
}

export default function DecisionesPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';

  const [records, setRecords]   = useState<DecisionRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal state
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<DecisionRecord | null>(null);
  const [form, setForm]             = useState<DecisionForm>(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');

  // Reference data
  const [projects, setProjects]     = useState<Project[]>([]);
  const [users, setUsers]           = useState<User[]>([]);

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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isManager) return;
    Promise.all([
      api.get<{ data: Project[] }>('/projects').catch(() => ({ data: [] })),
      api.get<{ data: User[] }>('/users').catch(() => ({ data: [] })),
    ]).then(([pRes, uRes]) => {
      setProjects((pRes as unknown as { data: Project[] }).data ?? (pRes as unknown as Project[]) ?? []);
      setUsers((uRes as unknown as { data: User[] }).data ?? (uRes as unknown as User[]) ?? []);
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

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(rec: DecisionRecord) {
    setEditing(rec);
    setForm({
      decision_date: rec.decision_date,
      description:   rec.description,
      project_id:    rec.project_id ? String(rec.project_id) : '',
      responsible_id: rec.responsible_id ? String(rec.responsible_id) : '',
      status:        rec.status,
      impact:        rec.impact,
      observations:  rec.observations ?? '',
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
    if (!confirm(`¿Eliminar la decisión "${rec.description.slice(0, 60)}…"?`)) return;
    try {
      await api.delete(`/decisions/${rec.id}`);
      load();
    } catch {
      alert('No se pudo eliminar la decisión.');
    }
  }

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
        <ClipboardList size={40} />
        <p className="text-sm">Acceso restringido a administradores y coordinadores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de Decisiones"
        subtitle="Seguimiento de decisiones clave del proyecto"
        actions={
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Nueva Decisión
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por descripción, proyecto, responsable…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{DECISION_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6"><StatsSkeleton /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400 gap-2">
            <ClipboardList size={36} />
            <p className="text-sm">No hay decisiones registradas.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Proyecto</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Impacto</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((rec) => (
                <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {new Date(rec.decision_date + 'T12:00:00').toLocaleDateString('es-CO', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate text-gray-900 font-medium" title={rec.description}>
                      {rec.description}
                    </p>
                    {rec.observations && (
                      <p className="text-xs text-gray-400 truncate" title={rec.observations}>
                        {rec.observations}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {rec.project?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {rec.responsible?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={DECISION_STATUS_LABELS[rec.status]} colorClass={STATUS_COLORS[rec.status]} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={DECISION_IMPACT_LABELS[rec.impact]} colorClass={IMPACT_COLORS[rec.impact]} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {filtered.length} decisión{filtered.length !== 1 ? 'es' : ''}
        </p>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Decisión' : 'Nueva Decisión'}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear'}
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
              <input
                type="date"
                value={form.decision_date}
                onChange={(e) => setForm((f) => ({ ...f, decision_date: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proyecto</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Sin proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Describe la decisión tomada…"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Responsable</label>
              <select
                value={form.responsible_id}
                onChange={(e) => setForm((f) => ({ ...f, responsible_id: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DecisionStatus }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{DECISION_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Impacto</label>
              <select
                value={form.impact}
                onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value as DecisionImpact }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {IMPACTS.map((i) => (
                  <option key={i} value={i}>{DECISION_IMPACT_LABELS[i]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
            <textarea
              value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Notas adicionales…"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
