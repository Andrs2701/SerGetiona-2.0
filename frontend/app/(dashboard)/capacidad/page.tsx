'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Gauge, Users, BatteryCharging, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SidePanel from '@/components/SidePanel';
import CapacityBar from '@/components/CapacityBar';
import { StatsSkeleton } from '@/components/LoadingSkeleton';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type {
  CapacityRole,
  CapacitySummary,
  CapacityTrendPoint,
  CapacityUser,
  ReassignmentSuggestion,
  UserRole,
} from '@/lib/types';
import { CAPACITY_STATUS_LABELS, ROLE_STATUS_LABELS, USER_ROLE_LABELS } from '@/lib/types';

interface UserActivity {
  id: number;
  role: UserRole;
  status: string;
  commitment_date?: string;
  is_overdue: boolean;
  points: number;
  deliverable: { id: number; name: string };
  program_name?: string;
}

interface SuggestionsState {
  activityId: number;
  loading: boolean;
  items: ReassignmentSuggestion[];
}

export default function CapacidadPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<CapacitySummary | null>(null);
  const [users, setUsers] = useState<CapacityUser[]>([]);
  const [roles, setRoles] = useState<CapacityRole[]>([]);
  const [trend, setTrend] = useState<CapacityTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<CapacityUser | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionsState | null>(null);
  const [reassigning, setReassigning] = useState(false);

  const isManager = user?.role === 'admin' || user?.role === 'coordinator';

  useEffect(() => {
    if (!isManager) return;
    Promise.all([
      api.get<{ summary: CapacitySummary; users: CapacityUser[] }>('/capacity'),
      api.get<{ roles: CapacityRole[] }>('/capacity/by-role'),
      api.get<{ series: CapacityTrendPoint[] }>('/capacity/trends?weeks=8'),
    ])
      .then(([cap, byRole, trends]) => {
        setSummary(cap.summary);
        setUsers(cap.users ?? []);
        setRoles(byRole.roles ?? []);
        setTrend(trends.series ?? []);
      })
      .catch(() => {
        setSummary(null);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [isManager]);

  async function openUser(u: CapacityUser) {
    setSelectedUser(u);
    setSuggestions(null);
    setActivitiesLoading(true);
    try {
      const res = await api.get<{ activities: UserActivity[] }>(
        `/capacity/users/${u.user_id}/activities`
      );
      setActivities(res.activities ?? []);
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }

  async function loadSuggestions(activityId: number) {
    setSuggestions({ activityId, loading: true, items: [] });
    try {
      const res = await api.get<{ suggestions: ReassignmentSuggestion[] }>(
        `/activities/${activityId}/reassignment-suggestions`
      );
      setSuggestions({ activityId, loading: false, items: res.suggestions ?? [] });
    } catch {
      setSuggestions({ activityId, loading: false, items: [] });
    }
  }

  async function reassign(activityId: number, newResponsibleId: number) {
    if (!confirm('¿Reasignar esta actividad al usuario sugerido?')) return;
    setReassigning(true);
    try {
      await api.put(`/activities/${activityId}`, { responsible_id: newResponsibleId });
      // Refrescar panel y listado general
      setSuggestions(null);
      if (selectedUser) await openUser(selectedUser);
      const cap = await api.get<{ summary: CapacitySummary; users: CapacityUser[] }>('/capacity');
      setSummary(cap.summary);
      setUsers(cap.users ?? []);
    } catch {
      alert('No se pudo reasignar la actividad.');
    } finally {
      setReassigning(false);
    }
  }

  if (!isManager) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">
          La capacidad operativa es información gerencial. No tienes acceso a este módulo.
        </p>
      </div>
    );
  }

  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.active_points, t.capacity_points)));

  return (
    <div className="p-6">
      <PageHeader
        title="Capacidad Operativa"
        subtitle="Carga semanal del equipo según complejidad de entregables"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Capacidad' }]}
      />

      {loading ? (
        <StatsSkeleton />
      ) : !summary ? (
        <p className="text-sm text-gray-400 py-12 text-center">No se pudo cargar la capacidad.</p>
      ) : (
        <div className="space-y-8">
          {/* Nivel 3: Global */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Gauge size={18} />}
              label="Utilización global"
              value={`${summary.utilization_pct.toFixed(0)}%`}
              tone={summary.status}
            />
            <KpiCard
              icon={<Users size={18} />}
              label="Capacidad semanal del equipo"
              value={`${summary.capacity_points} pts`}
            />
            <KpiCard
              icon={<BatteryCharging size={18} />}
              label="Capacidad disponible"
              value={`${summary.available_points} pts`}
            />
            <KpiCard
              icon={<AlertTriangle size={18} />}
              label="Usuarios sobrecargados"
              value={String(summary.overloaded_users)}
              tone={summary.overloaded_users > 0 ? 'overloaded' : 'ok'}
            />
          </div>

          {/* Nivel 2: Por rol */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Capacidad por rol</h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Personas</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Carga / Capacidad</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase w-1/3">Ocupación</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Sobrecargados</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.role} className="border-b border-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {USER_ROLE_LABELS[r.role] ?? r.role}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600">{r.users}</td>
                      <td className="px-3 py-3 text-center text-gray-600">
                        {r.active_points} / {r.capacity_points} pts
                      </td>
                      <td className="px-5 py-3">
                        <CapacityBar
                          utilizationPct={r.utilization_pct}
                          status={r.utilization_pct > 100 ? 'overloaded' : r.utilization_pct >= 80 ? 'high' : 'ok'}
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {r.overloaded_users > 0 ? (
                          <span className="text-red-600 font-semibold">{r.overloaded_users}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Nivel 1: Individual */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Capacidad individual
              <span className="ml-2 text-xs font-normal text-gray-400">
                ordenado por ocupación — click para ver actividades y sugerencias
              </span>
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
              {users.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => openUser(u)}
                  className="w-full px-5 py-3 flex items-center gap-4 hover:bg-gray-50 text-left"
                >
                  <div className="w-44 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.user_name}</p>
                    <p className="text-xs text-gray-400">{USER_ROLE_LABELS[u.role] ?? u.role}</p>
                  </div>
                  <div className="flex-1">
                    <CapacityBar
                      utilizationPct={u.utilization_pct}
                      status={u.status}
                      detail={`${u.active_points} / ${u.capacity_points} pts`}
                    />
                  </div>
                  <div className="w-40 flex-shrink-0 text-right">
                    <span
                      className={clsx(
                        'px-2 py-0.5 text-xs rounded-full font-medium',
                        u.status === 'overloaded'
                          ? 'bg-red-50 text-red-700'
                          : u.status === 'high'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      )}
                    >
                      {CAPACITY_STATUS_LABELS[u.status]}
                    </span>
                    {u.overdue > 0 && (
                      <p className="text-xs text-red-500 mt-1">{u.overdue} vencidas</p>
                    )}
                  </div>
                </button>
              ))}
              {users.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  No hay usuarios operativos con actividades.
                </p>
              )}
            </div>
          </section>

          {/* Tendencia */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Tendencia semanal</h2>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              {trend.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Aún no hay histórico suficiente. Los snapshots se generan automáticamente cada semana.
                </p>
              ) : (
                <div className="flex items-end gap-4 h-40">
                  {trend.map((t) => (
                    <div key={t.week_start} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{t.utilization_pct.toFixed(0)}%</span>
                      <div className="w-full flex items-end gap-1 flex-1">
                        <div
                          className="flex-1 bg-indigo-500 rounded-t"
                          style={{ height: `${(t.active_points / maxTrend) * 100}%` }}
                          title={`Carga: ${t.active_points} pts`}
                        />
                        <div
                          className="flex-1 bg-gray-200 rounded-t"
                          style={{ height: `${(t.capacity_points / maxTrend) * 100}%` }}
                          title={`Capacidad: ${t.capacity_points} pts`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {t.week_start.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-indigo-500 rounded-sm inline-block" /> Carga
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-gray-200 rounded-sm inline-block" /> Capacidad
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Panel: actividades del usuario + sugerencias de reasignación */}
      <SidePanel
        open={!!selectedUser}
        onClose={() => {
          setSelectedUser(null);
          setSuggestions(null);
        }}
        title={selectedUser ? `Carga de ${selectedUser.user_name}` : ''}
      >
        {selectedUser && (
          <div className="p-5 space-y-4">
            <CapacityBar
              utilizationPct={selectedUser.utilization_pct}
              status={selectedUser.status}
              detail={`${selectedUser.active_points} / ${selectedUser.capacity_points} pts`}
            />

            {activitiesLoading ? (
              <p className="text-sm text-gray-400 py-6 text-center">Cargando actividades…</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div
                    key={a.id}
                    className={clsx(
                      'border rounded-lg p-3',
                      a.is_overdue ? 'border-red-200 bg-red-50/50' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.deliverable.name}</p>
                        <p className="text-xs text-gray-500">
                          {a.program_name} · {ROLE_STATUS_LABELS[a.status] ?? a.status} ·{' '}
                          {a.points} pts
                        </p>
                        {a.commitment_date && (
                          <p className={clsx('text-xs mt-0.5', a.is_overdue ? 'text-red-600 font-medium' : 'text-gray-400')}>
                            {a.is_overdue ? 'Vencida — ' : 'Compromiso: '}
                            {a.commitment_date}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => loadSuggestions(a.id)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 flex-shrink-0"
                      >
                        <ArrowRightLeft size={13} />
                        Sugerencias
                      </button>
                    </div>

                    {suggestions?.activityId === a.id && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        {suggestions.loading ? (
                          <p className="text-xs text-gray-400">Buscando candidatos…</p>
                        ) : suggestions.items.length === 0 ? (
                          <p className="text-xs text-gray-400">
                            No hay otros usuarios activos con este rol.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Candidatos (mismo rol, menor carga)
                            </p>
                            {suggestions.items.map((s) => (
                              <div key={s.user_id} className="flex items-center justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-800">{s.name}</p>
                                  <p className="text-xs text-gray-400">
                                    {s.utilization_pct.toFixed(0)}% → {s.utilization_after.toFixed(0)}% si recibe esta actividad
                                  </p>
                                </div>
                                <button
                                  onClick={() => reassign(a.id, s.user_id)}
                                  disabled={reassigning}
                                  className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  Reasignar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-sm text-gray-400 py-6 text-center">
                    Sin actividades activas con fecha de compromiso.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'ok' | 'high' | 'overloaded';
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
      <p
        className={clsx(
          'text-2xl font-bold',
          tone === 'overloaded' ? 'text-red-600' : tone === 'high' ? 'text-amber-600' : 'text-gray-900'
        )}
      >
        {value}
      </p>
    </div>
  );
}
