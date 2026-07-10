'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Pencil, Plus, Trash2, GitBranch, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import type { StateTransition, SystemRole, SystemStatus, RoleStatus } from '@/lib/types';

const COLOR_OPTIONS = [
  'bg-gray-200', 'bg-gray-300', 'bg-amber-400', 'bg-blue-400', 'bg-blue-500',
  'bg-purple-400', 'bg-purple-500', 'bg-teal-500', 'bg-orange-400', 'bg-orange-500',
  'bg-emerald-500', 'bg-red-500', 'bg-gray-100',
];

const OPERATIVE_ROLES = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

const ROLE_LABELS: Record<string, string> = {
  expert: 'Experto Temático',
  pedagogy: 'Pedagogía',
  design: 'Diseño',
  audiovisual: 'Audiovisual',
  engineering: 'Ingeniería',
  qa: 'Calidad',
};

interface StatusForm {
  id?: number;
  type: 'deliverable' | 'task';
  slug: string;
  label: string;
  color: string;
  description: string;
  is_active: boolean;
  allowed_roles: string[];
  is_manager_only: boolean;
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
  const [roleStatuses, setRoleStatuses] = useState<RoleStatus[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<StatusForm | null>(null);
  const [transitionForm, setTransitionForm] = useState<TransitionForm | null>(null);
  const [roleStatusForm, setRoleStatusForm] = useState<{ role: string; status_slug: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const [statusRes, transRes, roleRes, roleStatusesRes] = await Promise.all([
        api.get<{ deliverable_statuses: SystemStatus[]; task_statuses: SystemStatus[] }>('/config/statuses'),
        api.get<{ transitions: StateTransition[] }>('/config/transitions'),
        api.get<{ roles: SystemRole[] }>('/config/roles'),
        api.get<{ role_statuses: RoleStatus[] }>('/config/role-statuses'),
      ]);
      setDeliverableStatuses(statusRes.deliverable_statuses ?? []);
      setTaskStatuses(statusRes.task_statuses ?? []);
      setTransitions(transRes.transitions ?? []);
      setRoles((roleRes.roles ?? []).filter((r) => r.is_active));
      setRoleStatuses(roleStatusesRes.role_statuses ?? []);
    } catch {
      setDeliverableStatuses([]);
      setTaskStatuses([]);
      setRoleStatuses([]);
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
          allowed_roles: form.type === 'task' ? form.allowed_roles : null,
          is_manager_only: form.type === 'task' ? form.is_manager_only : false,
        });
      } else {
        await api.post('/config/statuses', {
          type: form.type,
          slug: form.slug.trim().toLowerCase().replace(/\s+/g, '_'),
          label: form.label.trim(),
          color: form.color,
          description: form.description.trim() || null,
          is_active: form.is_active,
          allowed_roles: form.type === 'task' ? form.allowed_roles : null,
          is_manager_only: form.type === 'task' ? form.is_manager_only : false,
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

  async function handleAddRoleStatus() {
    if (!roleStatusForm || !roleStatusForm.role || !roleStatusForm.status_slug) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/config/role-statuses', roleStatusForm);
      setRoleStatusForm(null);
      await load();
    } catch {
      setError('El estado ya está asociado al rol o no existe.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoleStatus(id: number) {
    if (!confirm('¿Desasociar este estado del rol?')) return;
    try {
      await api.delete(`/config/role-statuses/${id}`);
      await load();
    } catch {
      alert('No se pudo desasociar el estado del rol.');
    }
  }

  async function handleMoveStatus(roleKey: string, index: number, direction: 'up' | 'down') {
    const associated = roleStatuses.filter((rs) => rs.role === roleKey);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === associated.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const items = [...associated];

    // Intercambiar elementos en el array local
    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;

    // Obtener los IDs en el nuevo orden
    const ids = items.map((x) => x.id);

    try {
      await api.post('/config/role-statuses/reorder', { ids });
      await load();
    } catch {
      alert('No se pudo reordenar el estado.');
    }
  }

  function statusLabel(type: string, slug: string): string {
    const list = type === 'deliverable' ? deliverableStatuses : taskStatuses;
    return list.find((s) => s.slug === slug)?.label ?? slug;
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Cargando estados…</div>;
  }

  const renderStatusList = (title: string, type: 'deliverable' | 'task', list: SystemStatus[]) => {
    const filteredList = type === 'task' && filterRole
      ? list.filter((s) => s.allowed_roles?.includes(filterRole))
      : list;

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {type === 'task' && (
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                <option value="">Filtrar por rol</option>
                {OPERATIVE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] ?? r}
                  </option>
                ))}
              </select>
            )}
          </div>
        <button
          onClick={() => setForm({
            type,
            slug: '',
            label: '',
            color: 'bg-gray-200',
            description: '',
            is_active: true,
            allowed_roles: [],
            is_manager_only: false
          })}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium"
        >
          <Plus size={13} />
          Agregar
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
        {filteredList.map((s) => (
          <div key={s.id} className="px-4 py-3 flex items-center gap-3 group">
            <div className={clsx('w-3 h-3 rounded-full flex-shrink-0', s.color ?? 'bg-gray-200')} />
            <div className="flex-1 min-w-0">
              <p className={clsx('text-sm font-medium', s.is_active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through')}>
                {s.label}
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-mono font-normal no-underline">{s.slug}</span>
              </p>
              {s.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.description}</p>}
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
                  allowed_roles: s.allowed_roles ?? [],
                  is_manager_only: s.is_manager_only ?? false,
                })}
                className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDeleteStatus(s)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {filteredList.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Sin estados.</div>
        )}
      </div>
    </div>
  );
}

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        {renderStatusList('Estados de Entregable', 'deliverable', deliverableStatuses)}
        {renderStatusList('Estados de Tarea / Actividad', 'task', taskStatuses)}
      </div>

      {/* Estados por Rol */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            <span>Estados por Rol</span>
          </h3>
          <button
            onClick={() => setRoleStatusForm({ role: 'expert', status_slug: '' })}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium"
          >
            <Plus size={13} />
            Asociar Estado
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Asocia los estados de tarea/actividad correspondientes a cada rol. Utiliza las flechas de ordenación para organizar la secuencia en que los verán los usuarios en su espacio de trabajo.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {OPERATIVE_ROLES.map((roleKey) => {
            const associated = roleStatuses.filter((rs) => rs.role === roleKey);
            return (
              <div key={roleKey} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50/30 dark:bg-gray-900/10">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{ROLE_LABELS[roleKey] ?? roleKey}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{associated.length} estado(s)</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 px-3 py-2">
                  {associated.map((rs, idx) => {
                    const statusObj = taskStatuses.find((ts) => ts.slug === rs.status_slug);
                    return (
                      <div key={rs.id} className="py-2.5 flex items-center justify-between text-xs group hover:bg-gray-50/50 dark:hover:bg-gray-700/20 px-2 rounded-lg transition-colors">
                        <div className="flex items-center gap-2">
                          <div className={clsx('w-2 h-2 rounded-full', statusObj?.color ?? 'bg-gray-300')} />
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{statusObj?.label ?? rs.status_slug}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">({rs.status_slug})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleMoveStatus(roleKey, idx, 'up')}
                            disabled={idx === 0}
                            className={clsx(
                              'text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors',
                              idx === 0 && 'opacity-20 cursor-not-allowed'
                            )}
                            title="Subir"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            onClick={() => handleMoveStatus(roleKey, idx, 'down')}
                            disabled={idx === associated.length - 1}
                            className={clsx(
                              'text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors',
                              idx === associated.length - 1 && 'opacity-20 cursor-not-allowed'
                            )}
                            title="Bajar"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteRoleStatus(rs.id)}
                            className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                            title="Desasociar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {associated.length === 0 && (
                    <p className="text-xs text-gray-400 italic py-2">Sin estados asociados.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transiciones */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Define qué cambios de estado están permitidos y qué roles pueden ejecutarlos.
        </p>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
          {transitions.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center gap-3 group flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">
                {t.type === 'task' ? 'Tarea' : 'Entregable'}
              </span>
              <span className="text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <strong>{statusLabel(t.type, t.from_status)}</strong>
                <ArrowRight size={13} className="text-gray-400" />
                <strong>{statusLabel(t.type, t.to_status)}</strong>
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-1 min-w-0 truncate">
                {(t.allowed_roles ?? []).map((slug) => roles.find((r) => r.slug === slug)?.name ?? slug).join(', ')}
              </span>
              <button
                onClick={() => handleDeleteTransition(t)}
                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
            <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
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
            {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            {!form.id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Identificador (slug)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="p. ej. en_pausa"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etiqueta visible</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="p. ej. En Pausa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            {form.type === 'task' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Roles autorizados</label>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                    {roles.map((r) => (
                      <label key={r.slug} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={form.allowed_roles.includes(r.slug)}
                          onChange={(e) => setForm({
                            ...form,
                            allowed_roles: e.target.checked
                              ? [...form.allowed_roles, r.slug]
                              : form.allowed_roles.filter((x) => x !== r.slug),
                          })}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        {r.name}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.is_manager_only}
                    onChange={(e) => setForm({ ...form, is_manager_only: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Exclusivo para coordinadores y administradores
                </label>
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
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
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
            {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
              <select
                value={transitionForm.type}
                onChange={(e) => setTransitionForm({
                  ...transitionForm,
                  type: e.target.value as 'deliverable' | 'task',
                  from_status: '',
                  to_status: '',
                })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="task">Tarea / Actividad</option>
                <option value="deliverable">Entregable</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['from_status', 'to_status'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field === 'from_status' ? 'Desde' : 'Hacia'}
                  </label>
                  <select
                    value={transitionForm[field]}
                    onChange={(e) => setTransitionForm({ ...transitionForm, [field]: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Roles autorizados</label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                {roles.map((r) => (
                  <label key={r.slug} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={transitionForm.allowed_roles.includes(r.slug)}
                      onChange={(e) => setTransitionForm({
                        ...transitionForm,
                        allowed_roles: e.target.checked
                           ? [...transitionForm.allowed_roles, r.slug]
                           : transitionForm.allowed_roles.filter((x) => x !== r.slug),
                      })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal asociar estado a rol */}
      <Modal
        open={!!roleStatusForm}
        onClose={() => { setRoleStatusForm(null); setError(null); }}
        title="Asociar Estado a Rol"
        footer={
          <>
            <button
              onClick={() => { setRoleStatusForm(null); setError(null); }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddRoleStatus}
              disabled={saving || !roleStatusForm?.role || !roleStatusForm?.status_slug}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        {roleStatusForm && (
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
              <select
                value={roleStatusForm.role}
                onChange={(e) => setRoleStatusForm({ ...roleStatusForm, role: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {OPERATIVE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado de Tarea</label>
              <select
                value={roleStatusForm.status_slug}
                onChange={(e) => setRoleStatusForm({ ...roleStatusForm, status_slug: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar estado…</option>
                {taskStatuses.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
