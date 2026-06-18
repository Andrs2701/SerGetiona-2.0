'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { ComplianceReport } from '@/lib/types';
import { ROLE_LABELS, GLOBAL_STATUS_LABELS } from '@/lib/types';
import PageHeader from '@/components/PageHeader';
import { Skeleton } from '@/components/LoadingSkeleton';
import { CheckCircle2, XCircle, BarChart2 } from 'lucide-react';

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
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && !data) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Reportes" />
        <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          No fue posible cargar el reporte.
        </div>
      </div>
    );
  }

  const report = data!;
  const totalByStatus = data ? Object.values(data.by_status).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Reportes"
        subtitle="Métricas de cumplimiento y producción académica"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Reportes' }]}
      />

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Cumplimiento Global</p>
            <p className="text-4xl font-bold text-indigo-600">{report.global_compliance}%</p>
            <div className="mt-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  report.global_compliance >= 80 ? 'bg-emerald-500' : report.global_compliance >= 50 ? 'bg-amber-400' : 'bg-red-400'
                )}
                style={{ width: `${report.global_compliance}%` }}
              />
            </div>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-5 flex items-start gap-4">
            <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold mb-1">Total Aprobados</p>
              <p className="text-4xl font-bold text-emerald-700">{report.total_approved}</p>
              <p className="text-xs text-emerald-600 mt-1">entregables aprobados</p>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 p-5 flex items-start gap-4">
            <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
              <XCircle size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-red-500 uppercase tracking-wide font-semibold mb-1">Con Retraso</p>
              <p className="text-4xl font-bold text-red-600">{report.total_delayed}</p>
              <p className="text-xs text-red-500 mt-1">entregables con retraso</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumplimiento por proyecto */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Cumplimiento por Proyecto</h3>
          {loading ? (
            <div className="space-y-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="space-y-4">
              {report.projects.map((p) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-700 truncate max-w-[60%]" title={p.name}>{p.name}</span>
                    <span className={clsx(
                      'text-sm font-bold ml-2',
                      p.compliance >= 80 ? 'text-emerald-600' : p.compliance >= 50 ? 'text-amber-600' : 'text-red-500'
                    )}>{p.compliance}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        p.compliance >= 80 ? 'bg-emerald-500' : p.compliance >= 50 ? 'bg-amber-400' : 'bg-red-400'
                      )}
                      style={{ width: `${p.compliance}%` }}
                    />
                  </div>
                  <div className="flex gap-4 mt-1.5">
                    <span className="text-xs text-gray-400">{p.total} total</span>
                    <span className="text-xs text-emerald-600 font-medium">{p.approved} aprobados</span>
                    {p.delayed > 0 && (
                      <span className="text-xs text-red-500 font-medium">{p.delayed} con retraso</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distribución de estados */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Distribución de Estados</h3>
          {loading ? (
            <div className="flex items-end gap-2 h-44">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex-1 animate-pulse bg-gray-200 rounded" style={{ height: `${40 + i * 15}px` }} />
              ))}
            </div>
          ) : (
            <div className="flex items-end gap-1.5 h-44">
              {Object.entries(report.by_status).map(([status, count]) => {
                const heightPct = totalByStatus > 0 ? (count / totalByStatus) * 100 : 0;
                const colorClass = STATUS_COLORS[status] ?? 'bg-gray-300';
                return (
                  <div key={status} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-xs text-gray-600 font-semibold">{count}</span>
                    <div
                      className={clsx('w-full rounded-t-md transition-all', colorClass)}
                      style={{ height: `${Math.max(heightPct * 1.4, 6)}px` }}
                      title={GLOBAL_STATUS_LABELS[status as GlobalStatus]}
                    />
                    <span className="text-[9px] text-gray-400 text-center leading-tight truncate w-full px-0.5">
                      {GLOBAL_STATUS_LABELS[status as GlobalStatus]?.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Entregas por Rol — cards instead of table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-500" />
          Entregas por Rol
        </h3>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {report.by_role.map((r) => {
              const total = r.on_time + r.delayed;
              const pct = total > 0 ? Math.round((r.on_time / total) * 100) : 0;
              return (
                <div key={r.role} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-3">{ROLE_LABELS[r.role]}</p>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-emerald-600 font-semibold">{r.on_time} a tiempo</span>
                    <span className="text-red-500 font-semibold">{r.delayed} tardías</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={clsx(
                    'text-xs font-bold',
                    pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'
                  )}>{pct}%</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
