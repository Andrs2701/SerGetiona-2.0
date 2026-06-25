'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import type { ResourceType, Role } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

const ROLES: Role[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

interface TypeForm {
  id?: number;
  role: Role;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

const EMPTY_FORM: TypeForm = { role: 'expert', name: '', description: '', is_active: true, sort_order: 0 };

export default function ResourceTypesConfig() {
  const [types, setTypes] = useState<ResourceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<TypeForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: ResourceType[] }>('/resource-types?all=1');
      setTypes(res.data ?? res as unknown as ResourceType[]);
    } catch {
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        role: form.role,
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_active: form.is_active,
        sort_order: form.sort_order,
      };
      if (form.id) {
        await api.put(`/resource-types/${form.id}`, body);
      } else {
        await api.post('/resource-types', body);
      }
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rt: ResourceType) {
    if (!confirm(`¿Eliminar "${rt.name}" del rol ${ROLE_LABELS[rt.role]}?`)) return;
    try {
      await api.delete(`/resource-types/${rt.id}`);
      await load();
    } catch (e) {
      const msg = e instanceof Error && e.message.includes('409')
        ? 'Este tipo tiene registros de producción. Desactívalo en su lugar.'
        : 'No se pudo eliminar.';
      alert(msg);
    }
  }

  const filtered = filterRole === 'all' ? types : types.filter((t) => t.role === filterRole);
  const grouped = ROLES.reduce<Record<Role, ResourceType[]>>((acc, r) => {
    acc[r] = filtered.filter((t) => t.role === r);
    return acc;
  }, {} as Record<Role, ResourceType[]>);

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Cargando tipos de recurso…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">Filtrar por rol:</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as Role | 'all')}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="all">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setForm({ ...EMPTY_FORM, sort_order: types.length + 1 })}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex-shrink-0"
        >
          <Plus size={15} />
          Nuevo tipo
        </button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Define qué tipos de recursos puede producir cada rol. Solo los tipos activos estarán disponibles
        para registrar producción al momento de entregar una actividad.
      </p>

      {ROLES.filter((r) => filterRole === 'all' || filterRole === r).map((role) => (
        <div key={role} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{ROLE_LABELS[role]}</h3>
            <span className="text-xs text-gray-400">{grouped[role].length} tipo(s)</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Descripción</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                <th className="text-right px-5 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grouped[role].map((t) => (
                <tr key={t.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-5 py-2.5 font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{t.description || '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={clsx(
                      'px-2 py-0.5 text-xs rounded-full font-medium',
                      t.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {t.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      onClick={() => setForm({ id: t.id, role: t.role, name: t.name, description: t.description || '', is_active: t.is_active, sort_order: t.sort_order })}
                      className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mr-3"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {grouped[role].length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-4 text-center text-gray-400 dark:text-gray-500 text-xs">
                    Sin tipos de recurso configurados para este rol.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar: ${form.name}` : 'Nuevo tipo de recurso'}
        footer={
          <>
            <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form?.name.trim()}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                disabled={!!form.id}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="p. ej. Multimedia"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción (opcional)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Descripción breve"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Tipo activo (disponible al registrar producción)
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
