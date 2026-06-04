'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { api, ENDPOINTS } from '@/lib/api';
import type { Workspace, WorkspaceActivity } from '@/lib/types';
import { MOCK_WORKSPACE } from '@/lib/mock-data';
import { ROLE_LABELS, GLOBAL_STATUS_LABELS } from '@/lib/types';
import DateStatusBadge from './DateStatusBadge';

const DATE_STATUS_SORT: Record<string, number> = {
  overdue: 0,
  approaching: 1,
  on_time: 2,
  completed: 3,
  not_applicable: 4,
};

export default function DashboardOperativo() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Workspace>(ENDPOINTS.MY_WORKSPACE)
      .then(setWorkspace)
      .catch(() => setWorkspace(MOCK_WORKSPACE))
      .finally(() => setLoading(false));
  }, []);

  const data = workspace ?? MOCK_WORKSPACE;

  const sorted: WorkspaceActivity[] = [...(data.activities ?? [])].sort(
    (a, b) =>
      (DATE_STATUS_SORT[a.date_status] ?? 9) - (DATE_STATUS_SORT[b.date_status] ?? 9) ||
      (a.commitment_date ?? '').localeCompare(b.commitment_date ?? '')
  );

  const statCards = [
    { label: 'Pendientes', value: data.stats.pending, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Próx. a vencer', value: data.stats.approaching, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Vencidas', value: data.stats.overdue, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Completadas', value: data.stats.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Espacio de Trabajo</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {data.user.name} · {(ROLE_LABELS as Record<string, string>)[data.role] ?? data.role}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
            <div className={`${bg} rounded-lg p-2.5`}>
              <Icon className={`${color} w-5 h-5`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activities table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Mis Actividades</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Programa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Asignatura</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entregable</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha Comp.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Indicador</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((act) => (
                <tr key={act.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 text-gray-700 truncate max-w-[140px]" title={act.project.name}>
                    {act.project.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]" title={act.program.name}>
                    {act.program.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]" title={act.subject.name}>
                    {act.subject.name}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[160px]" title={act.deliverable.name}>
                    {act.deliverable.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                      {(GLOBAL_STATUS_LABELS as Record<string, string>)[act.status] ?? act.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {act.commitment_date
                      ? new Date(act.commitment_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <DateStatusBadge date_status={act.date_status} commitment_date={act.commitment_date} show_date={false} />
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400 text-sm">
                    No tienes actividades asignadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
