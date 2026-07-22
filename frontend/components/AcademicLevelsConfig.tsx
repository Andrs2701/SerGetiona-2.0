'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import type { AcademicLevel } from '@/lib/types';

interface LevelForm {
  id?: number;
  name: string;
  is_active: boolean;
  sort_order: number;
}

const EMPTY_FORM: LevelForm = { name: '', is_active: true, sort_order: 0 };

export default function AcademicLevelsConfig() {
  const [levels, setLevels] = useState<AcademicLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<LevelForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ levels: AcademicLevel[] }>('/academic-levels?all=1');
      setLevels(res.levels ?? []);
    } catch {
      setLevels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        is_active: form.is_active,
        sort_order: form.sort_order,
      };
      if (form.id) {
        await api.put(`/academic-levels/${form.id}`, body);
      } else {
        await api.post('/academic-levels', body);
      }
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(level: AcademicLevel) {
    if (!confirm(`¿Eliminar el nivel "${level.name}"?`)) return;
    try {
      await api.delete(`/academic-levels/${level.id}`);
      await load();
    } catch (e) {
      const msg = e instanceof Error && e.message.includes('409')
        ? 'El nivel está asignado a entregables. Desactívalo en lugar de eliminarlo.'
        : 'No se pudo eliminar el nivel.';
      alert(msg);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Cargando niveles…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Nivel académico del entregable (Pregrado, Posgrado, Continuada, Curso, Externo…). Se usa
          en el formulario de entregables, los filtros y la carga masiva desde Excel.
        </p>
        <button
          onClick={() => setForm({ ...EMPTY_FORM, sort_order: levels.length + 1 })}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex-shrink-0"
        >
          <Plus size={15} />
          Nuevo nivel
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Nivel</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{l.name}</td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={clsx(
                        'px-2 py-0.5 text-xs rounded-full font-medium',
                        l.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {l.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() =>
                        setForm({
                          id: l.id,
                          name: l.name,
                          is_active: l.is_active,
                          sort_order: l.sort_order,
                        })
                      }
                      className="text-gray-400 hover:text-indigo-600 transition-colors mr-3"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(l)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {levels.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                    No hay niveles configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar: ${form.name}` : 'Nuevo nivel académico'}
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
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="p. ej. Posgrado"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              Nivel activo (disponible en formularios y filtros)
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
