'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { ComplianceReport } from '@/lib/types';
import { ROLE_LABELS, GLOBAL_STATUS_LABELS } from '@/lib/types';
import { MOCK_COMPLIANCE } from '@/lib/mock-data';
import PageHeader from '@/components/PageHeader';
import { Skeleton } from '@/components/LoadingSkeleton';

type GlobalStatus = 'unpublished' | 'pending_start' | 'in_progress' | 'in_review' | 'with_observations' | 'finished' | 'cancelled' | 'not_applicable';

const STATUS_COLORS: Record<string, string> = {
  unpublished: 'bg-gray-300',
  pending_start: 'bg-amber-400',
  in_progress: 'bg-blue-500',
  in_review: 'bg-purple-500',
  with_observations: 'bg-orange-500',
  finished: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  not_applicable: 'bg-gray-200',
};

export default function ReportesPage() {
  const [data, setData] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ComplianceReport>(ENDPOINTS.COMPLIANCE)
      .then(setData)
      .catch(() => setData(MOCK_COMPLIANCE))
      .finally(() => setLoading(false));
  }, []);

  const report = data ?? MOCK_COMPLIANCE;
  const maxProjectCompliance = 100;
  const totalByStatus = Object.values(report.by_status).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Reportes"
        subtitle="Métricas de cumplimiento y producción académica"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Reportes' }]}
      />

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Cumplimiento Global</p>
            <p className="text-4xl font-bold text-indigo-600">{report.global_compliance}%</p>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${report.global_compliance}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Total Aprobados</p>
            <p className="text-4xl font-bold text-emerald-600">{report.total_approved}</p>
            <p className="text-sm text-gray-500 mt-1">entregables aprobados</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Con Retraso</p>
            <p className="text-4xl font-bold text-red-500">{report.total_delayed}</p>
            <p className="text-sm text-gray-500 mt-1">entregables con retraso</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Cumplimiento por proyecto — barras horizontales */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Cumplimiento por Proyecto</h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-8" />)}</div>
          ) : (
            <div className="space-y-3">
              {report.projects.map((p) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 truncate max-w-[200px]" title={p.name}>{p.name}</span>
                    <span className="text-sm font-semibold text-gray-900 ml-2">{p.compliance}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        p.compliance >= 80 ? 'bg-emerald-500' : p.compliance >= 50 ? 'bg-amber-400' : 'bg-red-400'
                      )}
                      style={{ width: `${(p.compliance / maxProjectCompliance) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs text-gray-400">{p.total} total</span>
                    <span className="text-xs text-emerald-600">{p.approved} aprobados</span>
                    <span className="text-xs text-red-500">{p.delayed} con retraso</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distribución de estados — barras verticales */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Distribución de Estados</h3>
          {loading ? (
            <div className="flex items-end gap-2 h-40">{[1,2,3,4,5,6].map(i => <div key={i} className="flex-1 animate-pulse bg-gray-200 rounded" style={{ height: `${40 + i * 15}px` }} />)}</div>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {Object.entries(report.by_status).map(([status, count]) => {
                const heightPct = totalByStatus > 0 ? (count / totalByStatus) * 100 : 0;
                const colorClass = STATUS_COLORS[status] ?? 'bg-gray-300';
                return (
                  <div key={status} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-600 font-medium">{count}</span>
                    <div
                      className={clsx('w-full rounded-t-md', colorClass)}
                      style={{ height: `${Math.max(heightPct * 1.2, 6)}px` }}
                      title={GLOBAL_STATUS_LABELS[status as GlobalStatus]}
                    />
                    <span className="text-[10px] text-gray-400 text-center leading-tight">
                      {GLOBAL_STATUS_LABELS[status as GlobalStatus]?.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Entregas a tiempo vs tardías por rol */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Entregas por Rol</h3>
        {loading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">A Tiempo</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Con Retraso</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">% Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {report.by_role.map((r) => {
                  const total = r.on_time + r.delayed;
                  const pct = total > 0 ? Math.round((r.on_time / total) * 100) : 0;
                  return (
                    <tr key={r.role} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{ROLE_LABELS[r.role]}</td>
                      <td className="py-3 px-4 text-emerald-600 font-semibold">{r.on_time}</td>
                      <td className="py-3 px-4 text-red-500 font-semibold">{r.delayed}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                'h-full rounded-full',
                                pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}
