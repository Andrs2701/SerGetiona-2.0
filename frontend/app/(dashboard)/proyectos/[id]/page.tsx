'use client';

import { Fragment, useState, useEffect, useCallback, use } from 'react';
import { clsx } from 'clsx';
import { Search, ChevronDown, ChevronRight, Download, Upload, Clock, Edit3, Trash2 } from 'lucide-react';
import { api, ENDPOINTS, downloadCsv } from '@/lib/api';
import type { Project, Deliverable, AcademicProgram, RoleActivity, Role as RoleType, RoleStatus } from '@/lib/types';
import { ROLE_LABELS, GLOBAL_STATUS_LABELS, DELIVERABLE_TYPE_LABELS, ROLE_STATUS_LABELS } from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import SidePanel from '@/components/SidePanel';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import DeliverableFlow, { type FlowStep } from '@/components/DeliverableFlow';
import CommentThread from '@/components/CommentThread';
import ImportModal from '@/components/ImportModal';
import EvidencePanel from '@/components/EvidencePanel';
import NextResponsibleCard from '@/components/NextResponsibleCard';
import ComplexitySelect from '@/components/ComplexitySelect';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';

type Role = RoleType;

const ROLES: Role[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

// Solo "approved" requiere admin/coordinador — coincide con lo que ya exige el
// backend en RoleActivityController::update() (abort_if de "No puedes aprobar
// tu propia actividad"). "not_applicable" quedaba restringido aquí antes por
// error, desincronizado del backend y de Mi Espacio.
const MANAGER_ONLY_STATUSES = ['approved'];

const PROGRAM_HEADER_COLORS = [
  'bg-indigo-100 text-indigo-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
];

function buildFlowSteps(deliverable: Deliverable): FlowStep[] {
  return ROLES.map((role) => {
    const activity = (deliverable.role_activities ?? []).find((a) => a.role === role);
    const status = activity?.status ?? 'not_started';
    const completed = status === 'approved';
    const active = !completed && !!activity && status !== 'not_started';
    return {
      role,
      label: ROLE_LABELS[role],
      status: ROLE_STATUS_LABELS[status] ?? status,
      responsible: activity?.responsible?.name,
      completed,
      active,
    };
  });
}

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
  const { user } = useAuthContext();
  const router = useRouter();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';

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
  const selectedRole = selectedActivity?.activity.role;
  const { statuses: taskStatuses, loading: loadingStatuses } = useTaskStatuses(selectedRole);
  const [activityStatus, setActivityStatus] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<'info' | 'flow' | 'evidence' | 'comments'>('info');
  const [loadError, setLoadError] = useState(false);
  const [auditLogs, setAuditLogs] = useState<{ user: string; action: string; time: string; date: string }[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  async function handleEditSave() {
    if (!editName.trim()) return;
    setSavingProject(true);
    try {
      const updated = await api.put<Project>(ENDPOINTS.PROJECT(projectId), { name: editName });
      setProject(updated);
      setShowEditModal(false);
    } catch {
      alert('Error al actualizar el nombre de la Escuela / Proyecto.');
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDelete() {
    const hasActivities = deliverables.length > 0;
    const msg = hasActivities
      ? '¡ADVERTENCIA! Esta Escuela / Proyecto contiene entregables y actividades asociadas. Si la eliminas, se borrarán todos los datos permanentemente en cascada. ¿Estás seguro de que deseas proceder?'
      : '¿Estás seguro de que deseas eliminar esta Escuela / Proyecto?';
    if (!window.confirm(msg)) return;
    try {
      await api.delete(ENDPOINTS.PROJECT(projectId));
      router.push('/proyectos');
    } catch {
      alert('Error al eliminar la Escuela / Proyecto.');
    }
  }

  const loadAuditLogs = useCallback(() => {
    setLoadingAudit(true);
    api.get<{ audit_logs: any[] }>(`/projects/${projectId}/audit`)
      .then(res => setAuditLogs(res.audit_logs ?? []))
      .catch(() => setAuditLogs([]))
      .finally(() => setLoadingAudit(false));
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, loadAuditLogs]);

  const loadDeliverables = useCallback(() => {
    api.get<Deliverable[]>(ENDPOINTS.PROJECT_DELIVERABLES(projectId))
      .then(data => {
        setDeliverables(data);
        // Keep selected activity panel in sync
        setSelectedActivity(prev => {
          if (!prev) return null;
          const freshDel = data.find(d => d.id === prev.deliverable.id);
          if (!freshDel) return null;
          const freshAct = (freshDel.role_activities ?? []).find(a => a.id === prev.activity.id);
          return freshAct ? { activity: freshAct, deliverable: freshDel } : null;
        });
      })
      .catch(() => {});
  }, [projectId]);

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
        setProject(null);
        setDeliverables([]);
        setPrograms([]);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
    // Poll every 60 s so coordinators see updated statuses without manual refresh
    const iv = setInterval(loadDeliverables, 60_000);
    return () => clearInterval(iv);
  }, [projectId, loadDeliverables]);

  // Keep local status in sync with selected activity
  useEffect(() => {
    if (selectedActivity) {
      setActivityStatus(selectedActivity.activity.status);
    }
  }, [selectedActivity]);

  // Sin entrada explícita del usuario, los grupos cargan contraídos por
  // programa; al buscar o filtrar se expanden para mostrar los resultados.
  const hasFilters = !!(search || filterProgram || filterStatus);

  async function handleStatusChange(newStatus: string) {
    if (!selectedActivity) return;
    const previousStatus = selectedActivity.activity.status;
    setActivityStatus(newStatus);
    setStatusError(null);
    setSavingStatus(true);
    try {
      await api.put(ENDPOINTS.ROLE_ACTIVITY(selectedActivity.activity.id), { status: newStatus });
      // Optimistic local update
      setDeliverables((prev) =>
        prev.map((d) => {
          if (d.id !== selectedActivity.deliverable.id) return d;
          return {
            ...d,
            role_activities: (d.role_activities ?? []).map((a) =>
              a.id === selectedActivity.activity.id ? { ...a, status: newStatus } : a
            ),
          };
        })
      );
      // Re-fetch from server so all users see the change
      loadDeliverables();
    } catch (e) {
      setActivityStatus(previousStatus);
      const msg = e instanceof Error ? e.message : '';
      let friendlyMessage = 'No se pudo guardar. Verifica tus permisos e intenta de nuevo.';
      try {
        const jsonStart = msg.indexOf('{');
        if (jsonStart !== -1) {
          const errorJson = JSON.parse(msg.substring(jsonStart));
          if (errorJson.message) friendlyMessage = errorJson.message;
        } else if (msg) {
          friendlyMessage = msg;
        }
      } catch {
        if (msg) friendlyMessage = msg;
      }
      setStatusError(friendlyMessage);
      setTimeout(() => setStatusError(null), 4000);
    } finally {
      setSavingStatus(false);
    }
  }

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
      <div className="p-4 sm:p-6">
        <div className="h-8 bg-gray-200 rounded w-64 mb-4 animate-pulse" />
        <TableSkeleton rows={6} cols={9} />
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Proyecto no disponible" />
        <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          No fue posible cargar el proyecto o no tienes permiso para consultarlo.
        </div>
      </div>
    );
  }

  const proj = project;
  const roleStates = (() => {
    if (!selectedActivity || loadingStatuses) return [];
    let states = taskStatuses.map((s) => s.slug);
    if (!states.includes(selectedActivity.activity.status)) {
      states = [...states, selectedActivity.activity.status];
    }
    return states;
  })();
  const flowSteps = selectedActivity ? buildFlowSteps(selectedActivity.deliverable) : [];

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={proj.name}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Escuelas / Proyectos', href: '/proyectos' },
          { label: proj.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={proj.status} type="project" size="md" />
            {isManager && (
              <>
                <button
                  onClick={() => { setEditName(proj.name); setShowEditModal(true); }}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Edit3 size={13} />
                  Editar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 border border-red-200 text-red-700 bg-white hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={13} />
                  Eliminar
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto pb-px">
        {(['deliverables', 'programs', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-3 sm:px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
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
          {/* Filters + Export/Import */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-full sm:min-w-[220px] sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar asignatura o entregable..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <select
              value={filterProgram}
              onChange={(e) => setFilterProgram(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
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
              className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            >
              <option value="">Todos los estados</option>
              {Object.entries(GLOBAL_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
              <button
                onClick={() =>
                  downloadCsv(`/export/deliverables?project_id=${projectId}&format=csv`, `entregables_proyecto_${projectId}.csv`).catch(() => {})
                }
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Download size={14} />
                Exportar CSV
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 border border-indigo-200 text-indigo-700 px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
              >
                <Upload size={14} />
                Importar
              </button>
            </div>
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
                    const isCollapsed = collapsed[group.program_id] ?? !hasFilters;
                    return (
                      <Fragment key={`group-${group.program}`}>
                        {/* Program header row */}
                        <tr
                          className={clsx('cursor-pointer', PROGRAM_HEADER_COLORS[ci])}
                          onClick={() =>
                            setCollapsed((prev) => ({
                              ...prev,
                              [group.program_id]: !(prev[group.program_id] ?? !hasFilters),
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
                      </Fragment>
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
          {programs.map((prog) => (
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
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50 bg-white dark:bg-gray-800 rounded-b-lg">
            {loadingAudit ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                Cargando historial de cambios...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                No hay cambios registrados en este proyecto.
              </div>
            ) : (
              auditLogs.map((item, i) => (
                <div key={i} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {item.user ? item.user[0].toUpperCase() : 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{item.user}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">{item.action}</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Side panel for role activity detail */}
      <SidePanel
        open={!!selectedActivity}
        onClose={() => { setSelectedActivity(null); setSidePanelTab('info'); }}
        title={
          selectedActivity
            ? `${ROLE_LABELS[selectedActivity.activity.role as Role]} — ${selectedActivity.deliverable.name}`
            : ''
        }
        width="lg"
      >
        {selectedActivity && (
          <div className="flex flex-col h-full">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 px-4 pt-2 flex-shrink-0">
              {(['info', 'flow', 'evidence', 'comments'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidePanelTab(tab)}
                  className={clsx(
                    'px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    sidePanelTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab === 'info' ? 'Info' : tab === 'flow' ? 'Flujo' : tab === 'evidence' ? 'Evidencias' : 'Comentarios'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Info tab */}
              {sidePanelTab === 'info' && (
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Entregable</p>
                      <p className="font-medium text-gray-900 text-sm">{selectedActivity.deliverable.name}</p>
                      <p className="text-xs text-gray-500">{selectedActivity.deliverable.subject_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Responsable</p>
                      <p className="text-sm text-gray-800">
                        {selectedActivity.activity.responsible?.name ?? 'Sin asignar'}
                      </p>
                    </div>
                    {selectedActivity.activity.commitment_date && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Fecha Compromiso</p>
                        <p className="text-sm text-gray-800">{selectedActivity.activity.commitment_date}</p>
                      </div>
                    )}
                    {selectedActivity.activity.actual_delivery_date && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Entrega Real</p>
                        <p className="text-sm text-gray-800">{selectedActivity.activity.actual_delivery_date}</p>
                      </div>
                    )}
                  </div>

                  {selectedActivity.activity.notes && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Notas</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                        {selectedActivity.activity.notes}
                      </p>
                    </div>
                  )}

                  {/* Complexity selector */}
                  <ComplexitySelect
                    deliverableId={selectedActivity.deliverable.id}
                    value={selectedActivity.deliverable.complexity_level_id}
                    onChanged={(levelId) =>
                      setDeliverables((prev) =>
                        prev.map((d) =>
                          d.id === selectedActivity.deliverable.id
                            ? { ...d, complexity_level_id: levelId }
                            : d
                        )
                      )
                    }
                  />

                  {/* Status selector */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cambiar Estado</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={activityStatus}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={savingStatus}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 disabled:opacity-60"
                      >
                        {roleStates.map((s) => (
                          <option key={s} value={s}>
                            {ROLE_STATUS_LABELS[s] ?? s}
                          </option>
                        ))}
                      </select>
                      {savingStatus && <span className="text-xs text-gray-400">Guardando...</span>}
                    </div>
                    {statusError && (
                      <p className="mt-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {statusError}
                      </p>
                    )}
                  </div>

                  {/* Next responsible */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Próximo responsable</p>
                    <NextResponsibleCard />
                  </div>
                </div>
              )}

              {/* Flow tab */}
              {sidePanelTab === 'flow' && (
                <div className="p-5 space-y-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Flujo de Producción</p>
                  <DeliverableFlow steps={flowSteps} />
                  <NextResponsibleCard />
                </div>
              )}

              {/* Evidence tab */}
              {sidePanelTab === 'evidence' && (
                <EvidencePanel
                  deliverableId={selectedActivity.deliverable.id}
                  activityId={selectedActivity.activity.id}
                  role={selectedActivity.activity.role}
                />
              )}

              {/* Comments tab */}
              {sidePanelTab === 'comments' && (
                <CommentThread
                  deliverableId={selectedActivity.deliverable.id}
                  deliverableName={selectedActivity.deliverable.name}
                />
              )}
            </div>
          </div>
        )}
      </SidePanel>

      {/* Import Modal */}
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        projectId={projectId}
      />

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Escuela / Proyecto"
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleEditSave}
              disabled={savingProject || !editName.trim()}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingProject ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Escuela / Proyecto *</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              placeholder="Nombre del proyecto"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
