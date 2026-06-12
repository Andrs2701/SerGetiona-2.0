'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import type { SystemRole } from '@/lib/types';

interface RoleForm {
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
  isNew: boolean;
}

const EMPTY_FORM: RoleForm = { slug: '', name: '', description: '', is_active: true, isNew: true };

export default function SystemRolesConfig() {
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<RoleForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ roles: SystemRole[] }>('/config/roles');
      setRoles(res.roles ?? []);
    } catch {
      setRoles([]);
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
      if (form.isNew) {
        await api.post('/config/roles', {
          slug: form.slug.trim().toLowerCase().replace(/\s+/g, '_'),
          name: form.name.trim(),
          description: form.description.trim() || null,
          is_active: form.is_active,
        });
      } else {
        await api.put(`/config/roles/${form.slug}`, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          is_active: form.is_active,
        });
      }
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error && e.message.includes('422')
        ? 'El identificador ya existe o es inválido.'
        : 'Error al guardar el rol.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(role: SystemRole) {
    try {
      await api.put(`/config/roles/${role.slug}`, { is_active: !role.is_active });
      await load();
    } catch {
      alert('No se pudo actualizar el rol.');
    }
  }

  async function handleDelete(role: SystemRole) {
    if (!confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/config/roles/${role.slug}`);
      await load();
    } catch (e) {
      const msg = e instanceof Error && e.message.includes('409')
        ? 'No se puede eliminar: hay usuarios con este rol. Desactívalo en su lugar.'
        : 'No se pudo eliminar el rol.';
      alert(msg);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Cargando roles…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          Roles del sistema. Desactivar un rol bloquea el acceso de sus usuarios sin eliminar su historial.
        </p>
        <button
          onClick={() => setForm({ ...EMPTY_FORM })}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex-shrink-0"
        >
          <Plus size={15} />
          Nuevo rol
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {roles.map((r) => (
          <div key={r.slug} className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">
                {r.name}
                <span className="ml-2 text-xs text-gray-400 font-mono">{r.slug}</span>
              </p>
              {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => r.slug !== 'admin' && toggleActive(r)}
                disabled={r.slug === 'admin'}
                className={clsx(
                  'px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
                  r.is_active
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  r.slug === 'admin' && 'cursor-not-allowed opacity-70'
                )}
                title={r.slug === 'admin' ? 'El rol administrador no puede desactivarse' : 'Clic para cambiar'}
              >
                {r.is_active ? 'Activo' : 'Inactivo'}
              </button>
              <button
                onClick={() => setForm({
                  slug: r.slug,
                  name: r.name,
                  description: r.description ?? '',
                  is_active: r.is_active,
                  isNew: false,
                })}
                className="text-gray-400 hover:text-indigo-600 transition-colors"
              >
                <Pencil size={16} />
              </button>
              {r.slug !== 'admin' && (
                <button
                  onClick={() => handleDelete(r)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
        {roles.length === 0 && (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">No hay roles configurados.</div>
        )}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.isNew ? 'Nuevo rol' : `Editar: ${form?.name ?? ''}`}
        footer={
          <>
            <button
              onClick={() => setForm(null)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form?.name.trim() || (form?.isNew && !form.slug.trim())}
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
            {form.isNew && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Identificador (slug)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="p. ej. editor_estilo"
                />
                <p className="text-xs text-gray-400 mt-1">Sin espacios; se usa internamente y no puede cambiarse luego.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="p. ej. Editor de Estilo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Función de este rol dentro del flujo de producción"
              />
            </div>
            {form.slug !== 'admin' && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Rol activo (sus usuarios pueden ingresar a la plataforma)
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
