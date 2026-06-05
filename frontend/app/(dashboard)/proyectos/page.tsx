'use client';

import { useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, Search, Plus, Download, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { api, ENDPOINTS, downloadCsv } from '@/lib/api';
import type { Project, ProjectStatus } from '@/lib/types';
import { PROJECT_STATUS_LABELS } from '@/lib/types';
import { MOCK_PROJECTS, MOCK_USERS } from '@/lib/mock-data';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
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
  }),
  col.accessor('programs_count', {
    header: 'Programas',
    cell: (info) => <span className="text-gray-600 text-center block">{info.getValue()}</span>,
  }),
  col.accessor('deliverables_count', {
    header: 'Entregables',
    cell: (info) => <span className="text-gray-600 text-center block">{info.getValue()}</span>,
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

const PROJECT_STATUSES: ProjectStatus[] = [
  'draft', 'pending_params', 'parameterized', 'in_progress', 'suspended', 'finished', 'cancelled',
];

interface ProjectForm {
  name: string;
  description: string;
  status: ProjectStatus;
  responsible_id: string;
  start_date: string;
  end_date: string;
}

const emptyForm: ProjectForm = {
  name: '',
  description: '',
  status: 'draft',
  responsible_id: '',
  start_date: '',
  end_date: '',
};

export default function ProyectosPage() {
  const router = useRouter();
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    api
      .get<Project[]>(ENDPOINTS.PROJECTS)
      .then(setData)
      .catch(() => setData(MOCK_PROJECTS))
      .finally(() => setLoading(false));
  }, []);

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

  async function handleSave() {
    setSaving(true);
    try {
      const created = await api.post<Project>(ENDPOINTS.PROJECTS, {
        name: form.name,
        description: form.description || undefined,
        status: form.status,
        responsible_id: form.responsible_id ? Number(form.responsible_id) : undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      });
      setData((prev) => [...prev, created]);
    } catch {
      // If backend is off, just add locally with mock data
      const newProject: Project = {
        id: Date.now(),
        name: form.name,
        description: form.description,
        status: form.status,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        programs_count: 0,
        deliverables_count: 0,
        compliance_percentage: 0,
        created_at: new Date().toISOString(),
      };
      setData((prev) => [...prev, newProject]);
    } finally {
      setSaving(false);
      setShowModal(false);
      setForm(emptyForm);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Proyectos"
        subtitle="Gestión de proyectos de producción académica"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Proyectos' }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Download size={15} />
                Exportar
                <ChevronDown size={13} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-44 py-1">
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      downloadCsv('/export/projects?format=csv', 'proyectos.csv').catch(() => {});
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Exportar CSV
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              Nuevo Proyecto
            </button>
          </div>
        }
      />

      <div className="bg-white rounded-lg border border-gray-200">
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

        {loading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Modal nuevo proyecto */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setForm(emptyForm); }}
        title="Nuevo Proyecto"
        size="lg"
        footer={
          <>
            <button
              onClick={() => { setShowModal(false); setForm(emptyForm); }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Crear Proyecto'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nombre del proyecto"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Descripción del proyecto"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
              <select
                value={form.responsible_id}
                onChange={(e) => setForm((f) => ({ ...f, responsible_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sin asignar</option>
                {MOCK_USERS.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
