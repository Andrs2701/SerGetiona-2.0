'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SystemSetting } from '@/lib/types';

const GROUP_LABELS: Record<string, string> = {
  health: 'Salud de proyecto',
  capacity: 'Capacidad operativa',
};

export default function SystemParametersConfig() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ settings: SystemSetting[] }>('/settings')
      .then((res) => {
        const list = res.settings ?? [];
        setSettings(list);
        setValues(Object.fromEntries(list.map((s) => [s.key, s.value])));
      })
      .catch(() => setSettings([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const numeric = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, Number(v)])
      );
      await api.put('/settings', { values: numeric });
      setMessage('Parámetros guardados. Los cálculos usarán los nuevos valores.');
    } catch {
      setMessage('Error al guardar los parámetros.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Cargando parámetros…</div>;
  }

  const groups = [...new Set(settings.map((s) => s.group))];

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-gray-500">
        Estos parámetros controlan la fórmula de salud de proyecto y los umbrales de capacidad
        operativa. Los cambios aplican de inmediato sin tocar código.
      </p>

      {groups.map((group) => (
        <div key={group} className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">{GROUP_LABELS[group] ?? group}</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {settings
              .filter((s) => s.group === group)
              .map((s) => (
                <div key={s.key} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.key}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={values[s.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    className="w-24 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                </div>
              ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar parámetros'}
        </button>
        {message && <p className="text-sm text-gray-500">{message}</p>}
      </div>
    </div>
  );
}
