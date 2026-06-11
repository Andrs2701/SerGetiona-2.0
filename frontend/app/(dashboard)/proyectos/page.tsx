'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Download, ChevronDown,
  Calendar, Users2, FileText, TrendingUp, ArrowRight,
  LayoutGrid, List, GitBranch,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { api, ENDPOINTS, downloadCsv } from '@/lib/api';
import type { Project, ProjectStatus, PortfolioView, User } from '@/lib/types';
import { PROJECT_STATUS_LABELS } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { Skeleton } from '@/components/LoadingSkeleton';

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

function ComplianceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-red-400'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={clsx(
        'text-xs font-semibold w-9 text-right',
        value >= 80 ? 'text-emerald-600' : value >= 50 ? 'text-amber-600' : 'text-red-500'
      )}>
        {value}%
      </span>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">
            {project.name}
          </p>
          {project.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{project.description}</p>
          )}
        </div>
        <StatusBadge status={project.status} type="project" />
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500 font-medium">Cumplimiento</span>
          <TrendingUp size={13} className="text-gray-400" />
        </div>
        <ComplianceBar value={project.compliance_percentage} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <Users2 size={13} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{project.responsible?.name ?? 'Sin asignar'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText size={13} className="text-gray-400 flex-shrink-0" />
          <span>{project.deliverables_count} entregable{project.deliverables_count !== 1 ? 's' : ''}</span>
        </div>
        {project.start_date && (
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-gray-400 flex-shrink-0" />
            <span>{project.start_date}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <FileText size={13} className="text-indigo-400 flex-shrink-0" />
          <span>{project.programs_count} programa{project.programs_count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-indigo-500 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          Ver detalle <ArrowRight size={12} />
        </span>
      </div>
    </button>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-3 rounded" />)}
      </div>
    </div>
  );
}

// ── Table view ─────────────────────────────────────────────────────────────────
function ProjectsTable({ projects, onRowClick }: { projects: Project[]; onRowClick: (id: number) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Responsable</th>
            <th className="px-4 py-3">Entregables</th>
            <th className="px-4 py-3">Cumplimiento</th>
            <th className="px-4 py-3">Inicio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {projects.map((p) => (
            <tr
              key={p.id}
              onClick={() => onRowClick(p.id)}
              className="hover:bg-indigo-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{p.name}</td>
              <td className="px-4 py-3"><StatusBadge status={p.status} type="project" /></td>
              <td className="px-4 py-3 text-gray-600">{p.responsible?.name ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600 text-center">{p.deliverables_count}</td>
              <td className="px-4 py-3 w-32"><ComplianceBar value={p.compliance_percentage} /></td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.start_date ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Timeline view ──────────────────────────────────────────────────────────────
function ProjectsTimeline({ projects, onRowClick }: { projects: Project[]; onRowClick: (id: number) => void }) {
  const sorted = [...projects].sort((a, b) =>
    (a.start_date ?? '').localeCompare(b.start_date ?? '')
  );
  return (
    <div className="space-y-2">
      {sorted.map((p) => (
        <button
          key={p.id}
          onClick={() => onRowClick(p.id)}
          className="w-full flex items-center gap-4 bg-white rounded-xl border border-gray-200 px-5 py-4 text-left hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <div className="w-2 h-2 rounded-full flex-none bg-indigo-400" />
          <div className="flex-none w-28 text-xs text-gray-500">
            {p.start_date ?? 'Sin fecha'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{p.name}</p>
          </div>
          <StatusBadge status={p.status} type="project" />
          <ComplianceBar value={p.compliance_percentage} />
        </button>
      ))}
    </div>
  );
}

export default function ProyectosPage() {
  const router = useRouter();
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [view, setView] = useState<PortfolioView>('cards');
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api
      .get<Project[]>(ENDPOINTS.PROJECTS)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
    api.get<User[]>(ENDPOINTS.USERS)
      .then(setUsers)
      .catch(() => setUsers([]));
    // Load persisted view preference
    api.get<{ preferences: { portfolio_view?: PortfolioView } }>('/preferences')
      .then((res) => { if (res.preferences?.portfolio_view) setView(res.preferences.portfolio_view); })
      .catch(() => null);
  }, []);

  function changeView(v: PortfolioView) {
    setView(v);
    api.put('/preferences', { portfolio_view: v }).catch(() => null);
  }

  const filtered = useMemo(() => {
    return data.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.responsible?.name ?? '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

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
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Proyectos"
        subtitle="Gestión de proyectos de producción académica"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Proyectos' }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Download size={15} />
                <span className="hidden sm:inline">Exportar</span>
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
              className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nuevo Proyecto</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </div>
        }
      />

      {/* Filters + view toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyectos..."
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | '')}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
        >
          <option value="">Todos los estados</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
          ))}
        </select>
        {/* View toggle */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          {([
            { v: 'cards',    Icon: LayoutGrid, title: 'Tarjetas' },
            { v: 'table',    Icon: List,        title: 'Tabla' },
            { v: 'timeline', Icon: GitBranch,   title: 'Línea de tiempo' },
          ] as { v: PortfolioView; Icon: React.ElementType; title: string }[]).map(({ v, Icon, title }) => (
            <button
              key={v}
              onClick={() => changeView(v)}
              title={title}
              className={clsx(
                'px-3 py-2 transition-colors',
                view === v ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              )}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Project views */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <ProjectCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-400 text-sm">No se encontraron proyectos.</p>
        </div>
      ) : (
        <>
          {view === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => router.push(`/proyectos/${project.id}`)}
                />
              ))}
            </div>
          )}
          {view === 'table' && (
            <ProjectsTable
              projects={filtered}
              onRowClick={(id) => router.push(`/proyectos/${id}`)}
            />
          )}
          {view === 'timeline' && (
            <ProjectsTimeline
              projects={filtered}
              onRowClick={(id) => router.push(`/proyectos/${id}`)}
            />
          )}
          <p className="text-xs text-gray-400">{filtered.length} proyecto(s)</p>
        </>
      )}

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
                {users.filter((u) => u.is_active).map((u) => (
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
