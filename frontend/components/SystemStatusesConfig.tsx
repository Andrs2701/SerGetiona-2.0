'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Pencil, Plus, Trash2, GitBranch } from 'lucide-react';
import { clsx } from 'clsx';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import type { StateTransition, SystemRole, SystemStatus } from '@/lib/types';

const COLOR_OPTIONS = [
  'bg-gray-200', 'bg-gray-300', 'bg-amber-400', 'bg-blue-400', 'bg-blue-500',
  'bg-purple-400', 'bg-purple-500', 'bg-teal-500', 'bg-orange-400', 'bg-orange-500',
  'bg-emerald-500', 'bg-red-500', 'bg-gray-100',
];

interface StatusForm {
  id?: number;
  type: 'deliverable' | 'task';
  slug: string;
  label: string;
  color: string;
  description: string;
  is_active: boolean;
}

interface TransitionForm {
  type: 'deliverable' | 'task';
  from_status: string;
  to_status: string;
  allowed_roles: string[];
}

export default function SystemStatusesConfig() {
  const [deliverableStatuses, setDeliverableStatuses] = useState<SystemStatus[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<SystemStatus[]>([]);
  const [transitions, setTransitions] = useState<StateTransition[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<StatusForm | null>(null);
  const [transitionForm, setTransitionForm] = useState<TransitionForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusRes, transRes, roleRes] = await Promise.all([
        api.get<{ deliverable_statuses: SystemStatus[]; task_statuses: SystemStatus[] }>('/config/statuses'),
        api.get<{ transitions: StateTransition[] }>('/config/transitions'),
        api.get<{ roles: SystemRole[] }>('/config/roles'),
      ]);
      setDeliverableStatuses(statusRes.deliverable_statuses ?? []);
      setTaskStatuses(statusRes.task_statuses ?? []);
      setTransitions(transRes.transitions ?? []);
      setRoles((roleRes.roles ?? []).filter((r) => r.is_active));
    } catch {
      setDeliverableStatuses([]);
      setTaskStatuses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSaveStatus() {
    if (!form || !form.label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (form.id) {
        await api.put(`/config/statuses/${form.id}`, {
          label: form.label.trim(),
          color: form.color,
          description: form.description.trim() || null,
          is_active: form.is_active,
        });
      } else {
        await api.post('/config/statuses', {
          type: form.type,
          slug: form.slug.trim().toLowerCase().replace(/\s+/g, '_'),
          label: form.label.trim(),
          color: form.color,
          description: form.description.trim() || null,
          is_active: form.is_active,
        });
      }
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error && e.message.includes('422')
        ? 'El identificador ya existe para este tipo.'
        : 'Error al guardar el estado.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStatus(s: SystemStatus) {
    if (!confirm(`¿Eliminar el estado "${s.label}"?`)) return;
    try {
      await api.delete(`/config/statuses/${s.id}`);
      await load();
    } catch (e) {
      const msg = e instanceof Error && e.message.includes('409')
        ? 'Hay registros usando este estado. Desactívalo en su lugar.'
        : 'No se pudo eliminar el estado.';
      alert(msg);
    }
  }

  async function handleSaveTransition() {
    if (!transitionForm || !transitionForm.from_status || !transitionForm.to_status) return;
    if (transitionForm.from_status === transitionForm.to_status) {
      setError('El estado origen y destino no pueden ser iguales.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/config/transitions', transitionForm);
      setTransitionForm(null);
      await load();
    } catch {
      setError('Error al guardar la transición.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTransition(t: StateTransition) {
    if (!confirm(`¿Eliminar la transición ${t.from_status} → ${t.to_status}?`)) return;
    try {
      await api.delete(`/config/transitions/${t.id}`);
      await load();
    } catch {
      alert('No se pudo eliminar la transición.');
    }
  }

  function statusLabel(type: string, slug: string): string {
    const list = type === 'deliverable' ? deliverableStatuses : taskStatuses;
    return list.find((s) => s.slug === slug)?.label ?? slug;
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Cargando estados…</div>;
  }

  const renderStatusList = (title: string, type: 'deliverable' | 'task', list: SystemStatus[]) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <button
          onClick={() => setForm({ type, slug: '', label: '', color: 'bg-gray-200', description: '', is_active: true })}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium"
        >
          <Plus size={13} />
          Agregar
        </button>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
        {list.map((s) => (
          <div key={s.id} className="px-4 py-3 flex items-center gap-3 group">
            <div className={clsx('w-3 h-3 rounded-full flex-shrink-0', s.color ?? 'bg-gray-200')} />
            <div className="flex-1 min-w-0">
              <p className={clsx('text-sm font-medium', s.is_active ? 'text-gray-900' : 'text-gray-400 line-through')}>
                {s.label}
                <span className="ml-2 text-xs text-gray-400 font-mono font-normal no-underline">{s.slug}</span>
              </p>
              {s.description && <p className="text-xs text-gray-500 truncate">{s.description}</p>}
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={() => setForm({
                  id: s.id,
                  type: s.type,
                  slug: s.slug,
                  label: s.label,
                  color: s.color ?? 'bg-gray-200',
                  description: s.description ?? '',
                  is_active: s.is_active,
                })}
                className="text-gray-400 hover:text-indigo-600"
              >
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDeleteStatus(s)} className="text-gray-400 hover:text-red-600">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Sin estados.</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        {renderStatusList('Estados de Entregable', 'deliverable', deliverableStatuses)}
        {renderStatusList('Estados de Tarea / Actividad', 'task', taskStatuses)}
      </div>

      {/* Transiciones */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
            <GitBranch size={15} className="text-gray-400" />
            Transiciones de estado
          </h3>
          <button
            onClick={() => setTransitionForm({ type: 'task', from_status: '', to_status: '', allowed_roles: [] })}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium"
          >
            <Plus size={13} />
            Nueva transición
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Define qué cambios de estado están permitidos y qué roles pueden ejecutarlos.
        </p>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
          {transitions.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center gap-3 group flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex-shrink-0">
                {t.type === 'task' ? 'Tarea' : 'Entregable'}
              </span>
              <span className="text-sm text-gray-800 flex items-center gap-1.5">
                <strong>{statusLabel(t.type, t.from_status)}</strong>
                <ArrowRight size={13} className="text-gray-400" />
                <strong>{statusLabel(t.type, t.to_status)}</strong>
              </span>
              <span className="text-xs text-gray-400 flex-1 min-w-0 truncate">
                {(t.allowed_roles ?? []).map((slug) => roles.find((r) => r.slug === slug)?.name ?? slug).join(', ')}
              </span>
              <button
                onClick={() => handleDeleteTransition(t)}
                className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {transitions.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">Sin transiciones configuradas.</div>
          )}
        </div>
      </div>

      {/* Modal estado */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar: ${form.label}` : 'Nuevo estado'}
        footer={
          <>
            <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={handleSaveStatus}
              disabled={saving || !form?.label.trim() || (!form?.id && !form?.slug.trim())}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            {!form.id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Identificador (slug)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="p. ej. en_pausa"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta visible</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="p. ej. En Pausa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={clsx(
                      'w-7 h-7 rounded-full border-2 transition-transform',
                      c,
                      form.color === c ? 'border-indigo-600 scale-110' : 'border-transparent hover:scale-105'
                    )}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              Estado activo (disponible para nuevas asignaciones)
            </label>
          </div>
        )}
      </Modal>

      {/* Modal transición */}
      <Modal
        open={!!transitionForm}
        onClose={() => { setTransitionForm(null); setError(null); }}
        title="Nueva transición de estado"
        footer={
          <>
            <button
              onClick={() => { setTransitionForm(null); setError(null); }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveTransition}
              disabled={saving || !transitionForm?.from_status || !transitionForm?.to_status || transitionForm.allowed_roles.length === 0}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        {transitionForm && (
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={transitionForm.type}
                onChange={(e) => setTransitionForm({
                  ...transitionForm,
                  type: e.target.value as 'deliverable' | 'task',
                  from_status: '',
                  to_status: '',
                })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="task">Tarea / Actividad</option>
                <option value="deliverable">Entregable</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['from_status', 'to_status'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field === 'from_status' ? 'Desde' : 'Hacia'}
                  </label>
                  <select
                    value={transitionForm[field]}
                    onChange={(e) => setTransitionForm({ ...transitionForm, [field]: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Seleccionar…</option>
                    {(transitionForm.type === 'deliverable' ? deliverableStatuses : taskStatuses).map((s) => (
                      <option key={s.slug} value={s.slug}>{s.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Roles autorizados</label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto border border-gray-100 rounded-lg p-3">
                {roles.map((r) => (
                  <label key={r.slug} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={transitionForm.allowed_roles.includes(r.slug)}
                      onChange={(e) => setTransitionForm({
                        ...transitionForm,
                        allowed_roles: e.target.checked
                          ? [...transitionForm.allowed_roles, r.slug]
                          : transitionForm.allowed_roles.filter((x) => x !== r.slug),
                      })}
                      className="rounded border-gray-300"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
