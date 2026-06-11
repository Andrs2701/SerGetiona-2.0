'use client';

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useState, useEffect } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { api, ENDPOINTS } from '@/lib/api';
import type { Project } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/LoadingSkeleton';

const col = createColumnHelper<Project>();

const columns = [
  col.accessor('name', {
    header: 'Proyecto',
    cell: (info) => <span className="font-medium text-gray-900">{info.getValue()}</span>,
  }),
  col.accessor('status', {
    header: 'Estado',
    cell: (info) => <StatusBadge status={info.getValue()} type="project" />,
    filterFn: 'equals',
  }),
  col.accessor('programs_count', {
    header: 'Programas',
    cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
  }),
  col.accessor('deliverables_count', {
    header: 'Entregables',
    cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
  }),
  col.accessor('compliance_percentage', {
    header: 'Cumplimiento',
    cell: (info) => {
      const v = info.getValue();
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
            <div
              className={clsx(
                'h-full rounded-full',
                v >= 80 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-400' : 'bg-red-400'
              )}
              style={{ width: `${v}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-8">{v}%</span>
        </div>
      );
    },
  }),
  col.accessor('responsible', {
    header: 'Responsable',
    cell: (info) => {
      const r = info.getValue();
      return <span className="text-gray-600">{r ? r.name : '—'}</span>;
    },
  }),
  col.accessor('start_date', {
    header: 'Fecha Inicio',
    cell: (info) => <span className="text-gray-500 text-sm">{info.getValue() ?? '—'}</span>,
  }),
];

interface ProyectosTableProps {
  limit?: number;
}

export default function ProyectosTable({ limit }: ProyectosTableProps) {
  const router = useRouter();
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  useEffect(() => {
    api
      .get<Project[]>(ENDPOINTS.PROJECTS)
      .then((projects) => setData(limit ? projects.slice(0, limit) : projects))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) return <TableSkeleton rows={4} cols={7} />;

  return (
    <div>
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar proyectos..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-100 bg-gray-50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/proyectos/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
        {table.getRowModel().rows.length} proyecto(s)
      </div>
    </div>
  );
}

