'use client';

import { useState, useEffect, use } from 'react';
import { clsx } from 'clsx';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { api, ENDPOINTS } from '@/lib/api';
import type { Project, Deliverable, AcademicProgram, RoleActivity, Role as RoleType } from '@/lib/types';
import { ROLE_LABELS, GLOBAL_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from '@/lib/types';
import {
  MOCK_PROJECTS,
  MOCK_PROGRAMS,
  MOCK_DELIVERABLES,
} from '@/lib/mock-data';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import SidePanel from '@/components/SidePanel';
import { TableSkeleton } from '@/components/LoadingSkeleton';

type Role = RoleType;

const ROLES: Role[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

const PROGRAM_HEADER_COLORS = [
  'bg-indigo-100 text-indigo-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
];

function RoleCell({
  activity,
  onClick,
}: {
  activity?: RoleActivity;
  onClick: () => void;
}) {
  if (!activity) return <td className="px-2 py-2 text-center text-gray-300 text-xs">—</td>;

  return (
    <td
      className="px-2 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <div className="flex flex-col gap-0.5 items-start min-w-[90px]">
        {activity.responsible && (
          <span className="text-xs text-gray-600 truncate max-w-[90px]" title={activity.responsible.name}>
            {activity.responsible.name.split(' ')[0]}
          </span>
        )}
        <StatusBadge status={activity.status} type="role" size="sm" />
      </div>
    </td>
  );
}

interface ProgramGroup {
  program: string;
  program_id: number;
  deliverables: Deliverable[];
  colorIdx: number;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deliverables' | 'programs' | 'audit'>('deliverables');
  const [search, setSearch] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [selectedActivity, setSelectedActivity] = useState<{
    activity: RoleActivity;
    deliverable: Deliverable;
  } | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [proj, delivs, progs] = await Promise.all([
          api.get<Project>(ENDPOINTS.PROJECT(projectId)),
          api.get<Deliverable[]>(ENDPOINTS.PROJECT_DELIVERABLES(projectId)),
          api.get<AcademicProgram[]>(ENDPOINTS.PROJECT_PROGRAMS(projectId)),
        ]);
        setProject(proj);
        setDeliverables(delivs);
        setPrograms(progs);
      } catch {
        setProject(MOCK_PROJECTS.find((p) => p.id === projectId) ?? MOCK_PROJECTS[0]);
        setDeliverables(MOCK_DELIVERABLES.filter((d) => d.project_name === (MOCK_PROJECTS.find(p => p.id === projectId)?.name ?? MOCK_PROJECTS[0].name) || true).slice(0, 7));
        setPrograms(MOCK_PROGRAMS.filter((p) => p.project_id === projectId));
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [projectId]);

  // Build program groups
  const filteredDeliverables = deliverables.filter((d) => {
    const matchSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.subject_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchProgram = !filterProgram || String(d.program_id) === filterProgram;
    const matchStatus = !filterStatus || d.global_status === filterStatus;
    return matchSearch && matchProgram && matchStatus;
  });

  const programMap: Record<string, ProgramGroup> = {};
  const programColorMap: Record<string, number> = {};
  let colorIdx = 0;

  filteredDeliverables.forEach((d) => {
    const key = d.program_name ?? 'Sin Programa';
    if (!programColorMap[key]) {
      programColorMap[key] = colorIdx++;
    }
    if (!programMap[key]) {
      programMap[key] = {
        program: key,
        program_id: d.program_id ?? 0,
        deliverables: [],
        colorIdx: programColorMap[key],
      };
    }
    programMap[key].deliverables.push(d);
  });

  const programGroups = Object.values(programMap);
  const uniquePrograms = [...new Set(deliverables.map((d) => d.program_name).filter(Boolean))];

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 bg-gray-200 rounded w-64 mb-4 animate-pulse" />
        <TableSkeleton rows={6} cols={9} />
      </div>
    );
  }

  const proj = project ?? MOCK_PROJECTS[0];

  return (
    <div className="p-6">
      <PageHeader
        title={proj.name}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Proyectos', href: '/proyectos' },
          { label: proj.name },
        ]}
        actions={<StatusBadge status={proj.status} type="project" size="md" />}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(['deliverables', 'programs', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab === 'deliverables' ? 'Entregables' : tab === 'programs' ? 'Programas' : 'Auditoría'}
          </button>
        ))}
      </div>

      {/* Tab: Entregables */}
      {activeTab === 'deliverables' && (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar asignatura o entregable..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={filterProgram}
              onChange={(e) => setFilterProgram(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos los programas</option>
              {uniquePrograms.map((p) => (
                <option key={p} value={String(deliverables.find((d) => d.program_name === p)?.program_id)}>
                  {p}
                </option>
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

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-6" />
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Asignatura</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entregable</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado Global</th>
                    {ROLES.map((r) => (
                      <th key={r} className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cumpl.</th>
                  </tr>
                </thead>
                <tbody>
                  {programGroups.map((group) => {
                    const ci = group.colorIdx % PROGRAM_HEADER_COLORS.length;
                    const isCollapsed = collapsed[group.program_id];
                    return (
                      <>
                        {/* Program header row */}
                        <tr
                          key={`group-${group.program}`}
                          className={clsx('cursor-pointer', PROGRAM_HEADER_COLORS[ci])}
                          onClick={() =>
                            setCollapsed((prev) => ({
                              ...prev,
                              [group.program_id]: !prev[group.program_id],
                            }))
                          }
                        >
                          <td className="px-3 py-2">
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </td>
                          <td colSpan={11} className="px-3 py-2 font-semibold text-sm">
                            {group.program} — {group.deliverables.length} entregable(s)
                          </td>
                        </tr>
                        {/* Deliverable rows */}
                        {!isCollapsed &&
                          group.deliverables.map((d) => {
                            const activitiesByRole: Record<string, RoleActivity> = {};
                            (d.role_activities ?? []).forEach((a) => {
                              activitiesByRole[a.role] = a;
                            });
                            const compliance = d.compliance_percentage ?? 0;
                            return (
                              <tr
                                key={d.id}
                                className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                              >
                                <td />
                                <td className="px-3 py-2 text-gray-700">{d.subject_name}</td>
                                <td className="px-3 py-2 font-medium text-gray-900 max-w-[160px] truncate" title={d.name}>
                                  {d.name}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="text-xs text-gray-500">{DELIVERABLE_TYPE_LABELS[d.type]}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <StatusBadge status={d.global_status} type="global" />
                                </td>
                                {ROLES.map((r) => (
                                  <RoleCell
                                    key={r}
                                    activity={activitiesByRole[r]}
                                    onClick={() => {
                                      if (activitiesByRole[r]) {
                                        setSelectedActivity({
                                          activity: activitiesByRole[r],
                                          deliverable: d,
                                        });
                                      }
                                    }}
                                  />
                                ))}
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={clsx(
                                          'h-full rounded-full',
                                          compliance >= 80 ? 'bg-emerald-500' : compliance >= 50 ? 'bg-amber-400' : 'bg-red-400'
                                        )}
                                        style={{ width: `${compliance}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500">{compliance}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </>
                    );
                  })}
                  {programGroups.length === 0 && (
                    <tr>
                      <td colSpan={12} className="text-center py-10 text-gray-400 text-sm">
                        No se encontraron entregables con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Programas */}
      {activeTab === 'programs' && (
        <div className="space-y-4">
          {(programs.length > 0 ? programs : MOCK_PROGRAMS).map((prog) => (
            <div key={prog.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{prog.name}</h3>
                  {prog.code && <span className="text-xs text-gray-500">{prog.code}</span>}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{prog.subjects_count ?? 0} asignaturas</span>
                  <span>{prog.deliverables_count ?? 0} entregables</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Auditoría */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Historial de cambios</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { user: 'Ana Rodríguez', action: 'Cambió estado de "Semana 0" a En Revisión', time: 'Hace 2 horas' },
              { user: 'Carlos Méndez', action: 'Asignó responsable de Experto a Laura Torres', time: 'Hace 5 horas' },
              { user: 'Laura Torres', action: 'Actualizó fecha compromiso del rol Experto', time: 'Hace 1 día' },
              { user: 'Ana Rodríguez', action: 'Creó el entregable "Módulo 1 - Bases Teóricas"', time: 'Hace 2 días' },
              { user: 'Administrador', action: 'Cambió estado del proyecto a En Ejecución', time: 'Hace 3 días' },
            ].map((item, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {item.user[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800 text-sm">{item.user}</span>
                  <span className="text-gray-500 text-sm ml-1">{item.action}</span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side panel for role activity detail */}
      <SidePanel
        open={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        title={
          selectedActivity
            ? `${ROLE_LABELS[selectedActivity.activity.role as Role]} — ${selectedActivity.deliverable.name}`
            : ''
        }
      >
        {selectedActivity && (
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs text-gray-500 mb-1">Entregable</p>
              <p className="font-medium text-gray-900">{selectedActivity.deliverable.name}</p>
              <p className="text-sm text-gray-500">{selectedActivity.deliverable.subject_name}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Responsable</p>
              <p className="text-sm text-gray-800">
                {selectedActivity.activity.responsible?.name ?? 'Sin asignar'}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Estado</p>
              <StatusBadge status={selectedActivity.activity.status} type="role" size="md" />
            </div>

            {selectedActivity.activity.commitment_date && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Fecha Compromiso</p>
                <p className="text-sm text-gray-800">{selectedActivity.activity.commitment_date}</p>
              </div>
            )}

            {selectedActivity.activity.actual_start_date && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Inicio Real</p>
                <p className="text-sm text-gray-800">{selectedActivity.activity.actual_start_date}</p>
              </div>
            )}

            {selectedActivity.activity.actual_delivery_date && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Entrega Real</p>
                <p className="text-sm text-gray-800">{selectedActivity.activity.actual_delivery_date}</p>
              </div>
            )}

            {selectedActivity.activity.notes && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Notas</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                  {selectedActivity.activity.notes}
                </p>
              </div>
            )}

            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cambiar Estado</p>
              <div className="flex flex-wrap gap-2">
                {['not_started', 'in_progress', 'in_review', 'approved', 'with_observations'].map((s) => (
                  <button
                    key={s}
                    className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <StatusBadge status={s} type="role" size="sm" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
