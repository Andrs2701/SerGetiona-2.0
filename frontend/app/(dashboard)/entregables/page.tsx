'use client';

import { useState, useEffect } from 'react';
import { Search, CheckCircle2, Circle } from 'lucide-react';
import { api, ENDPOINTS } from '@/lib/api';
import type { Deliverable } from '@/lib/types';
import { GLOBAL_STATUS_LABELS, DELIVERABLE_TYPE_LABELS, ROLE_LABELS } from '@/lib/types';
import { MOCK_DELIVERABLES } from '@/lib/mock-data';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { TableSkeleton } from '@/components/LoadingSkeleton';

type Role = 'expert' | 'pedagogy' | 'design' | 'audiovisual' | 'engineering' | 'qa';
const ROLES: Role[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

function RoleIcon({ status }: { status?: string }) {
  if (!status || status === 'not_started' || status === 'pending') {
    return <Circle size={14} className="text-gray-300" />;
  }
  if (status === 'approved') {
    return <CheckCircle2 size={14} className="text-emerald-500" />;
  }
  if (status === 'not_applicable') {
    return <span className="text-gray-300 text-xs">—</span>;
  }
  return <Circle size={14} className="text-blue-400" />;
}

export default function EntregablesPage() {
  const [data, setData] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    api
      .get<Deliverable[]>(ENDPOINTS.DELIVERABLES)
      .then(setData)
      .catch(() => setData(MOCK_DELIVERABLES))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter((d) => {
    const matchSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.subject_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.project_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || d.type === filterType;
    const matchStatus = !filterStatus || d.global_status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Entregables"
        subtitle="Todos los entregables del sistema"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Entregables' }]}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por proyecto, programa, asignatura..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(DELIVERABLE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          {Object.entries(GLOBAL_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={7} cols={10} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proyecto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Programa</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Asignatura</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entregable</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    {ROLES.map((r) => (
                      <th key={r} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase" title={ROLE_LABELS[r]}>
                        {ROLE_LABELS[r].slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const activitiesByRole: Record<string, string | undefined> = {};
                    (d.role_activities ?? []).forEach((a) => {
                      activitiesByRole[a.role] = a.status;
                    });
                    return (
                      <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-[120px] truncate" title={d.project_name}>
                          {d.project_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-[120px] truncate" title={d.program_name}>
                          {d.program_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{d.subject_name ?? '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate" title={d.name}>
                          {d.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500">{DELIVERABLE_TYPE_LABELS[d.type]}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={d.global_status} type="global" />
                        </td>
                        {ROLES.map((r) => (
                          <td key={r} className="px-2 py-3 text-center">
                            <div className="flex justify-center">
                              <RoleIcon status={activitiesByRole[r]} />
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={12} className="text-center py-10 text-gray-400 text-sm">
                        No se encontraron entregables.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
              {filtered.length} entregable(s)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
