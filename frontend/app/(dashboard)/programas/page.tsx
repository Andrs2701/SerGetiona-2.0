'use client';

import { useState, useEffect } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { api, ENDPOINTS } from '@/lib/api';
import type { AcademicProgram } from '@/lib/types';
import { MOCK_PROGRAMS } from '@/lib/mock-data';
import PageHeader from '@/components/PageHeader';
import { TableSkeleton } from '@/components/LoadingSkeleton';

export default function ProgramasPage() {
  const [data, setData] = useState<AcademicProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get<AcademicProgram[]>(ENDPOINTS.PROGRAMS)
      .then(setData)
      .catch(() => setData(MOCK_PROGRAMS))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Programas Académicos"
        subtitle="Listado de programas académicos del sistema"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Programas Académicos' }]}
      />

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar programas..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <div key={p.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={18} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{p.name}</p>
                    {p.code && <p className="text-xs text-gray-500">{p.code}</p>}
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{p.subjects_count ?? 0}</p>
                      <p className="text-xs">Asignaturas</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{p.deliverables_count ?? 0}</p>
                      <p className="text-xs">Entregables</p>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-10 text-center text-gray-400 text-sm">
                  No se encontraron programas.
                </div>
              )}
            </div>
            <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
              {filtered.length} programa(s)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
