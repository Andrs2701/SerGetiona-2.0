'use client';

import { useState, useEffect } from 'react';
import {
  FolderKanban,
  BookOpen,
  Activity,
  XCircle,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Users,
  Clock,
} from 'lucide-react';
import DashboardOperativo from '@/components/DashboardOperativo';
import { StatsSkeleton } from '@/components/LoadingSkeleton';
import { api, ENDPOINTS } from '@/lib/api';
import type { DashboardStats, ProgramBreakdown, ActivityByRoleDetail } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { useAuthContext } from '@/contexts/AuthContext';

const ADMIN_ROLES = ['admin', 'coordinator'] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'bg-indigo-500' }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function progressColor(pct: number) {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

function GlobalRing({ value }: { value: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width="144" height="144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="72" cy="72" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold text-gray-900">{value}%</p>
        <p className="text-xs text-gray-500 mt-0.5">Avance</p>
      </div>
    </div>
  );
}

// MOCK fallback for admin stats
const MOCK_ADMIN_STATS: DashboardStats = {
  active_projects: 2,
  total_programs: 4,
  total_deliverables: 45,
  total_activities: 270,
  finished_deliverables: 9,
  finished_activities: 54,
  active_activities: 87,
  with_observations: 5,
  compliance_percentage: 20,
  global_compliance_percentage: 20,
  overdue_activities: 14,
  approaching_activities: 8,
  deliverables_by_status: {
    in_progress: 12, finished: 9, with_observations: 5, in_review: 6,
    pending_start: 8, unpublished: 3, cancelled: 0, not_applicable: 2,
  },
  activities_by_role_detail: [
    { role: 'expert', total: 45, approved: 18, active: 15, overdue: 6 },
    { role: 'pedagogy', total: 45, approved: 14, active: 18, overdue: 8 },
    { role: 'design', total: 45, approved: 10, active: 12, overdue: 5 },
    { role: 'audiovisual', total: 45, approved: 6, active: 8, overdue: 3 },
    { role: 'engineering', total: 45, approved: 4, active: 6, overdue: 2 },
    { role: 'qa', total: 45, approved: 2, active: 4, overdue: 1 },
  ],
  programs_breakdown: [
    { id: 1, name: 'Esp. Bienestar Psicosocial', project_id: 1, project_name: 'Actualización Curricular 2026', total: 25, finished: 18, compliance_percentage: 72, overdue_count: 2, active_count: 5, pending_count: 7 },
    { id: 2, name: 'Maestría Atención Comunitaria', project_id: 1, project_name: 'Actualización Curricular 2026', total: 20, finished: 8, compliance_percentage: 40, overdue_count: 5, active_count: 7, pending_count: 12 },
    { id: 3, name: 'Esp. Psicosocial (nueva)', project_id: 2, project_name: 'Creación Especialización', total: 48, finished: 4, compliance_percentage: 8, overdue_count: 12, active_count: 18, pending_count: 44 },
    { id: 4, name: 'Control Cambios Derecho', project_id: 3, project_name: 'Control de Cambios Q1', total: 37, finished: 33, compliance_percentage: 89, overdue_count: 0, active_count: 2, pending_count: 4 },
  ],
};

// ─── Status label/color map ───────────────────────────────────────────────────

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  finished:          { label: 'Finalizado',        color: 'bg-emerald-500' },
  in_progress:       { label: 'En Ejecución',       color: 'bg-blue-500' },
  in_review:         { label: 'En Revisión',        color: 'bg-purple-500' },
  with_observations: { label: 'Con Observaciones',  color: 'bg-amber-400' },
  pending_start:     { label: 'Pend. Inicio',       color: 'bg-gray-400' },
  unpublished:       { label: 'Sin Publicar',       color: 'bg-gray-300' },
  cancelled:         { label: 'Cancelado',          color: 'bg-red-300' },
  not_applicable:    { label: 'No Aplica',          color: 'bg-slate-300' },
};

// ─── Dashboard Admin ──────────────────────────────────────────────────────────

function DashboardAdmin() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardStats>(ENDPOINTS.DASHBOARD)
      .then(setStats)
      .catch(() => setStats(MOCK_ADMIN_STATS))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <StatsSkeleton />
      </div>
    );
  }

  const d = stats ?? MOCK_ADMIN_STATS;
  const globalPct = d.global_compliance_percentage ?? d.compliance_percentage ?? 0;
  const programs: ProgramBreakdown[] = d.programs_breakdown ?? [];
  const roleDetail: ActivityByRoleDetail[] = d.activities_by_role_detail ?? [];
  const byStatus = d.deliverables_by_status ?? {};

  // Sort programs for rankings
  const byProgress = [...programs].sort((a, b) => b.compliance_percentage - a.compliance_percentage);
  const byOverdue  = [...programs].sort((a, b) => b.overdue_count - a.overdue_count).filter(p => p.overdue_count > 0);

  // Flow bottleneck: role with most active (non-approved) activities
  const maxActive = Math.max(...roleDetail.map((r) => r.active), 1);

  // Status distribution total
  const statusTotal = Object.values(byStatus).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="p-6 space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visión global de producción académica</p>
      </div>

      {/* ── Row 1: KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Proyectos Activos', value: d.active_projects, icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Programas', value: d.total_programs, icon: BookOpen, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Actvs. Activas', value: d.active_activities ?? '—', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Finalizadas', value: d.finished_activities ?? '—', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Vencidas', value: d.overdue_activities, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', highlight: (d.overdue_activities ?? 0) > 0 },
          { label: 'Por Vencer', value: d.approaching_activities, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg, highlight }) => (
          <div
            key={label}
            className={`rounded-xl border p-4 flex flex-col gap-2 ${highlight ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}
          >
            <div className={`${bg} rounded-lg p-2 self-start`}>
              <Icon className={`${color} w-4 h-4`} />
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Row 2: Global ring + Status distribution ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Global compliance ring */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-8">
          <GlobalRing value={Math.round(globalPct)} />
          <div className="flex-1 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Avance global de la organización</p>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Total entregables</span>
                <span className="font-semibold">{d.total_deliverables}</span>
              </div>
              <div className="flex justify-between">
                <span>Finalizados</span>
                <span className="font-semibold text-emerald-600">{d.finished_deliverables}</span>
              </div>
              <div className="flex justify-between">
                <span>Vencidos</span>
                <span className="font-semibold text-red-600">{d.overdue_activities}</span>
              </div>
              <div className="flex justify-between">
                <span>Con observaciones</span>
                <span className="font-semibold text-amber-600">{d.with_observations}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Deliverables by status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Distribución por estado</h3>
          </div>
          <div className="space-y-2.5">
            {Object.entries(STATUS_INFO)
              .map(([key, info]) => ({ key, ...info, count: byStatus[key] ?? 0 }))
              .filter((s) => s.count > 0)
              .sort((a, b) => b.count - a.count)
              .map(({ key, label, color, count }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-32 shrink-0 truncate">{label}</span>
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${color}`}
                        style={{ width: `${(count / statusTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Program progress + Flow bottleneck ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Program progress bars */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Avance por programa</h3>
          </div>
          {programs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin datos de programas</p>
          ) : (
            <div className="space-y-4">
              {byProgress.map((p) => (
                <div key={p.id}>
                  <div className="flex justify-between items-end mb-1">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{p.project_name}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-700 ml-3 shrink-0">{p.compliance_percentage}%</span>
                  </div>
                  <ProgressBar value={p.compliance_percentage} color={progressColor(p.compliance_percentage)} />
                  <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                    <span>{p.finished}/{p.total} finalizados</span>
                    {p.overdue_count > 0 && <span className="text-red-500 font-medium">· {p.overdue_count} vencidas</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flow bottleneck by role */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Carga por etapa del flujo</h3>
            <span className="text-[10px] text-gray-400 ml-auto">Actividades activas</span>
          </div>
          {roleDetail.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin datos de flujo</p>
          ) : (
            <div className="space-y-3">
              {[...roleDetail]
                .sort((a, b) => b.active - a.active)
                .map((r) => (
                  <div key={r.role} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-24 shrink-0">{ROLE_LABELS[r.role] ?? r.role}</span>
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full ${r.overdue > 0 ? 'bg-red-400' : 'bg-blue-400'}`}
                          style={{ width: `${(r.active / maxActive) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-right w-20 shrink-0 justify-end">
                      <span className="font-semibold text-gray-700">{r.active}</span>
                      {r.overdue > 0 && (
                        <span className="text-red-500 font-medium">({r.overdue} venc.)</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-4">
            · Barras rojas indican etapas con actividades vencidas — posibles cuellos de botella
          </p>
        </div>
      </div>

      {/* ── Row 4: Rankings ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Programs with most overdue */}
        {byOverdue.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle size={16} className="text-red-400" />
              <h3 className="text-sm font-semibold text-gray-700">Programas con más vencimientos</h3>
            </div>
            <div className="space-y-3">
              {byOverdue.slice(0, 5).map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4 shrink-0">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{p.project_name}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600 shrink-0">{p.overdue_count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Programs with lowest progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-gray-700">Programas con menor avance</h3>
          </div>
          <div className="space-y-3">
            {[...programs]
              .sort((a, b) => a.compliance_percentage - b.compliance_percentage)
              .slice(0, 5)
              .map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4 shrink-0">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{p.project_name}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${progressColor(p.compliance_percentage).replace('bg-', 'text-')}`}>
                    {p.compliance_percentage}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="p-6">
        <StatsSkeleton />
      </div>
    );
  }

  const isAdmin = user && ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number]);
  return isAdmin ? <DashboardAdmin /> : <DashboardOperativo />;
}
