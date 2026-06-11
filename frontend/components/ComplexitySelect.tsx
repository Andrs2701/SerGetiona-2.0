'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ComplexityLevel } from '@/lib/types';

interface ComplexitySelectProps {
  deliverableId: number;
  value: number | null | undefined;
  onChanged?: (levelId: number | null) => void;
}

/**
 * Selector de nivel de complejidad de un entregable. La escritura está
 * restringida a admin/coordinator en backend; este componente solo se
 * monta en vistas gerenciales.
 */
export default function ComplexitySelect({ deliverableId, value, onChanged }: ComplexitySelectProps) {
  const [levels, setLevels] = useState<ComplexityLevel[]>([]);
  const [current, setCurrent] = useState<number | ''>(value ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ levels: ComplexityLevel[] }>('/complexity-levels')
      .then((res) => setLevels(res.levels ?? []))
      .catch(() => setLevels([]));
  }, []);

  useEffect(() => {
    setCurrent(value ?? '');
  }, [value, deliverableId]);

  async function handleChange(raw: string) {
    const levelId = raw === '' ? null : Number(raw);
    setCurrent(raw === '' ? '' : Number(raw));
    setSaving(true);
    try {
      await api.put(`/deliverables/${deliverableId}`, { complexity_level_id: levelId });
      onChanged?.(levelId);
    } catch {
      setCurrent(value ?? '');
    } finally {
      setSaving(false);
    }
  }

  if (levels.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Complejidad</p>
      <div className="flex items-center gap-2">
        <select
          value={current}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 disabled:opacity-60"
        >
          <option value="">Sin clasificar</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.points} pts)
            </option>
          ))}
        </select>
        {saving && <span className="text-xs text-gray-400">Guardando...</span>}
      </div>
    </div>
  );
}
