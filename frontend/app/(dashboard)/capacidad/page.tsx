'use client';

import { useEffect, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Gauge, Users, BatteryCharging, AlertTriangle,
  ArrowRightLeft, Settings, ChevronDown, ChevronRight, Save,
} from 'lucide-react';
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

interface SystemSetting {
  id: number;
  key: string;
  value: string;
  label: string;
  group: string;
}

const CAPACITY_SETTINGS_META = [
  {
    key: 'capacity.default_weekly_points',
    label: 'Capacidad base por persona',
    description: 'Puntos de trabajo que puede asumir un profesional por semana cuando no tiene capacidad personalizada configurada.',
    unit: 'pts / semana',
    min: 1, max: 200, step: 1,
  },
  {
    key: 'capacity.default_points',
    label: 'Peso por defecto de actividad',
    description: 'Puntos que consume una actividad cuando el entregable no tiene nivel de complejidad asignado.',
    unit: 'pts',
    min: 0.5, max: 50, step: 0.5,
  },
  {
    key: 'capacity.threshold_high',
    label: 'Umbral de ocupación alta',
    description: 'Porcentaje de utilización a partir del cual la carga se considera alta (se muestra en amarillo).',
    unit: '%',
    min: 50, max: 99, step: 5,
  },
  {
    key: 'capacity.threshold_overload',
    label: 'Umbral de sobrecarga',
    description: 'Porcentaje a partir del cual se considera sobrecarga crítica (se muestra en rojo).',
    unit: '%',
    min: 80, max: 300, step: 5,
  },
] as const;

export default function CapacidadPage() {
  const { user } = useAuth();

  const [summary, setSummary] = useState<CapacitySummary | null>(null);
  const [users, setUsers] = useState<CapacityUser[]>([]);
  const [roles, setRoles] = useState<CapacityRole[]>([]);
  const [trend, setTrend] = useState<CapacityTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // User detail panel
  const [selectedUser, setSelectedUser] = useState<CapacityUser | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionsState | null>(null);
  const [reassigning, setReassigning] = useState(false);

  // Role table expand state
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const isManager = user?.role === 'admin' || user?.role === 'coordinator';
  const isAdmin = user?.role === 'admin';

  const loadData = useCallback(async () => {
    if (!isManager) return;
    setLoading(true);
    try {
      const [cap, byRole, trends] = await Promise.all([
        api.get<{ summary: CapacitySummary; users: CapacityUser[] }>('/capacity'),
        api.get<{ roles: CapacityRole[] }>('/capacity/by-role'),
        api.get<{ series: CapacityTrendPoint[] }>('/capacity/trends?weeks=8'),
      ]);
      setSummary(cap.summary);
      setUsers(cap.users ?? []);
      setRoles(byRole.roles ?? []);
      setTrend(trends.series ?? []);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  useEffect(() => { loadData(); }, [loadData]);

  async function openSettingsPanel() {
    setSettingsOpen(true);
    setSettingsSaved(false);
    setSettingsLoading(true);
    try {
      const res = await api.get<{ settings: SystemSetting[] }>('/settings?group=capacity');
      const list = res.settings ?? [];
      setSettings(list);
      const draft: Record<string, string> = {};
      list.forEach(s => { draft[s.key] = s.value; });
      setSettingsDraft(draft);
    } catch {
      setSettings([]);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    try {
      const values: Record<string, number> = {};
      Object.entries(settingsDraft).forEach(([k, v]) => { values[k] = parseFloat(v); });
      await api.put('/settings', { values });
      setSettingsSaved(true);
      await loadData();
    } catch {
      alert('Error al guardar la configuración.');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function openUser(u: CapacityUser) {
    setSelectedUser(u);
    setSuggestions(null);
    setActivitiesLoading(true);
    try {
      const res = await api.get<{ activities: UserActivity[] }>(`/capacity/users/${u.user_id}/activities`);
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

  function toggleRole(role: string) {
    setExpandedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  if (!isManager) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-gray-500">
          La capacidad operativa es información gerencial. No tienes acceso a este módulo.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Capacidad Operativa"
        subtitle="Carga semanal del equipo según complejidad de entregables"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Capacidad' }]}
        actions={isAdmin ? (
          <button
            onClick={openSettingsPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Settings size={14} />
            Parámetros
          </button>
        ) : undefined}
      />

      {loading ? (
        <StatsSkeleton />
      ) : !summary ? (
        <p className="text-sm text-gray-400 py-12 text-center">No se pudo cargar la capacidad.</p>
      ) : (
        <div className="space-y-8">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Gauge size={18} />}
              label="Utilización global"
              value={`${summary.utilization_pct.toFixed(0)}%`}
              tone={summary.status}
            />
            <KpiCard
              icon={<Users size={18} />}
              label="Capacidad total del equipo"
              value={`${summary.capacity_points} pts`}
            />
            <KpiCard
              icon={<BatteryCharging size={18} />}
              label="Capacidad disponible"
              value={`${summary.available_points} pts`}
            />
            <KpiCard
              icon={<AlertTriangle size={18} />}
              label="Personas sobrecargadas"
              value={String(summary.overloaded_users)}
              tone={summary.overloaded_users > 0 ? 'overloaded' : 'ok'}
            />
          </div>

          {/* Capacidad por rol — expandable con individuales */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Capacidad por rol</h2>
              <span className="text-xs text-gray-400">
                Haz clic en un rol para ver a sus miembros
              </span>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_140px_200px_100px] bg-gray-50 border-b border-gray-200 px-4 py-2.5">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Rol / Persona</span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">Pers.</span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">Carga / Capacidad</span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide pl-1">Ocupación</span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">Estado</span>
              </div>

              {roles.map((r) => {
                const roleUsers = users.filter(u => u.role === r.role);
                const expanded = expandedRoles.has(r.role);
                const status: 'ok' | 'high' | 'overloaded' =
                  r.utilization_pct > 100 ? 'overloaded' : r.utilization_pct >= 80 ? 'high' : 'ok';

                return (
                  <div key={r.role} className="border-b border-gray-100 last:border-0">
                    {/* Role header row */}
                    <button
                      onClick={() => toggleRole(r.role)}
                      className="w-full grid grid-cols-[1fr_80px_140px_200px_100px] px-4 py-3.5 hover:bg-gray-50 items-center text-left transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 flex-shrink-0">
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {USER_ROLE_LABELS[r.role] ?? r.role}
                        </span>
                        {expanded && (
                          <span className="text-[11px] text-gray-400 font-normal">
                            {roleUsers.length} miembro{roleUsers.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-center text-gray-500">{r.users}</span>
                      <span className={clsx(
                        'text-sm text-center font-medium tabular-nums',
                        status === 'overloaded' ? 'text-red-600' :
                        status === 'high' ? 'text-amber-600' : 'text-gray-600'
                      )}>
                        {r.active_points} / {r.capacity_points} pts
                      </span>
                      <div className="pr-2">
                        <CapacityBar utilizationPct={r.utilization_pct} status={status} />
                      </div>
                      <div className="text-center">
                        {r.overloaded_users > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                            <AlertTriangle size={11} />
                            {r.overloaded_users} sobre
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded: individual members */}
                    {expanded && (
                      <div className="border-t border-gray-100">
                        {roleUsers.length === 0 ? (
                          <p className="pl-12 py-3 text-xs text-gray-400 italic">Sin miembros activos.</p>
                        ) : (
                          roleUsers.map((u, idx) => (
                            <button
                              key={u.user_id}
                              onClick={() => openUser(u)}
                              className={clsx(
                                'w-full grid grid-cols-[1fr_80px_140px_200px_100px] px-4 py-2.5 hover:bg-indigo-50/40 items-center text-left transition-colors',
                                idx > 0 ? 'border-t border-gray-50' : ''
                              )}
                            >
                              {/* Name + avatar */}
                              <div className="flex items-center gap-3 pl-7">
                                <div className={clsx(
                                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold',
                                  u.status === 'overloaded' ? 'bg-red-100 text-red-700' :
                                  u.status === 'high' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600'
                                )}>
                                  {u.user_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm text-gray-800 font-medium leading-tight">{u.user_name}</p>
                                  {u.overdue > 0 && (
                                    <p className="text-[11px] text-red-500 leading-tight">
                                      {u.overdue} vencida{u.overdue !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {/* Pers column — empty for individuals */}
                              <div />
                              {/* Carga */}
                              <span className={clsx(
                                'text-xs text-center tabular-nums',
                                u.status === 'overloaded' ? 'text-red-500 font-medium' :
                                u.status === 'high' ? 'text-amber-600' : 'text-gray-500'
                              )}>
                                {u.active_points} / {u.capacity_points} pts
                              </span>
                              {/* Bar */}
                              <div className="pr-2">
                                <CapacityBar utilizationPct={u.utilization_pct} status={u.status} />
                              </div>
                              {/* Status badge */}
                              <div className="text-center">
                                <span className={clsx(
                                  'px-2 py-0.5 text-[11px] rounded-full font-medium',
                                  u.status === 'overloaded' ? 'bg-red-50 text-red-700' :
                                  u.status === 'high' ? 'bg-amber-50 text-amber-700' :
                                  'bg-emerald-50 text-emerald-700'
                                )}>
                                  {CAPACITY_STATUS_LABELS[u.status]}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {roles.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  No hay datos de capacidad por rol.
                </p>
              )}
            </div>
          </section>

          {/* Tendencia semanal — mejorada */}
          <TrendChart trend={trend} />
        </div>
      )}

      {/* Panel: actividades del usuario */}
      <SidePanel
        open={!!selectedUser}
        onClose={() => { setSelectedUser(null); setSuggestions(null); }}
        title={selectedUser ? `Carga de ${selectedUser.user_name}` : ''}
      >
        {selectedUser && (
          <div className="p-5 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <CapacityBar
                utilizationPct={selectedUser.utilization_pct}
                status={selectedUser.status}
                detail={`${selectedUser.active_points} / ${selectedUser.capacity_points} pts`}
              />
              <div className="flex gap-4 text-xs text-gray-500">
                <span>{selectedUser.active_activities} actividades activas</span>
                {selectedUser.overdue > 0 && (
                  <span className="text-red-500 font-medium">{selectedUser.overdue} vencida{selectedUser.overdue !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Actividades con carga esta semana
            </p>

            {activitiesLoading ? (
              <p className="text-sm text-gray-400 py-6 text-center">Cargando actividades…</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div
                    key={a.id}
                    className={clsx(
                      'border rounded-lg p-3',
                      a.is_overdue ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.deliverable.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{a.program_name}</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-500">{ROLE_STATUS_LABELS[a.status] ?? a.status}</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs font-semibold text-indigo-600">{a.points} pts</span>
                        </div>
                        {a.commitment_date && (
                          <p className={clsx('text-xs mt-1', a.is_overdue ? 'text-red-600 font-medium' : 'text-gray-400')}>
                            {a.is_overdue ? '⚠ Vencida: ' : 'Compromiso: '}
                            {a.commitment_date}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => loadSuggestions(a.id)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 flex-shrink-0 mt-0.5"
                      >
                        <ArrowRightLeft size={12} />
                        Reasignar
                      </button>
                    </div>

                    {suggestions?.activityId === a.id && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        {suggestions.loading ? (
                          <p className="text-xs text-gray-400">Buscando candidatos…</p>
                        ) : suggestions.items.length === 0 ? (
                          <p className="text-xs text-gray-400">No hay otros usuarios disponibles con este rol.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                              Candidatos — mismo rol, menor carga
                            </p>
                            {suggestions.items.map((s) => (
                              <div key={s.user_id} className="flex items-center justify-between gap-2 py-1">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-800 font-medium">{s.name}</p>
                                  <p className="text-xs text-gray-400">
                                    {s.utilization_pct.toFixed(0)}%{' '}
                                    <span className="text-gray-300 mx-0.5">→</span>{' '}
                                    <span className={s.utilization_after > 100 ? 'text-red-500' : s.utilization_after > 80 ? 'text-amber-500' : 'text-emerald-600'}>
                                      {s.utilization_after.toFixed(0)}%
                                    </span>
                                    {' '}con esta actividad
                                  </p>
                                </div>
                                <button
                                  onClick={() => reassign(a.id, s.user_id)}
                                  disabled={reassigning}
                                  className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  Asignar
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
                    Sin actividades activas con fecha de compromiso esta semana.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {/* Panel: configuración de parámetros */}
      <SidePanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Parámetros de capacidad"
      >
        <div className="p-5 space-y-5">
          <p className="text-sm text-gray-500 leading-relaxed">
            Controla cómo se calculan la carga y los umbrales de alerta del equipo.
            Los cambios se aplican en tiempo real a todos los reportes.
          </p>

          {settingsSaved && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Configuración guardada correctamente
            </div>
          )}

          {settingsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {CAPACITY_SETTINGS_META.map((meta) => {
                const val = settingsDraft[meta.key] ?? '';
                const dbSetting = settings.find(s => s.key === meta.key);
                return (
                  <div key={meta.key} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <label className="text-sm font-semibold text-gray-900">{meta.label}</label>
                      <span className="text-xs text-gray-400 flex-shrink-0">{meta.unit}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed">{meta.description}</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={val}
                        min={meta.min}
                        max={meta.max}
                        step={meta.step}
                        onChange={e => setSettingsDraft(prev => ({ ...prev, [meta.key]: e.target.value }))}
                        className="w-28 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                      <span className="text-sm text-gray-400">{meta.unit}</span>
                      {dbSetting && parseFloat(dbSetting.value) !== parseFloat(val) && (
                        <span className="text-xs text-amber-600 ml-auto">Cambiado</span>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                onClick={saveSettings}
                disabled={settingsSaving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
              >
                <Save size={15} />
                {settingsSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>
      </SidePanel>
    </div>
  );
}

// ─── Trend Chart ────────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: CapacityTrendPoint[] }) {
  const CHART_H = 160; // px for the bar area
  // Y scale goes to at least 120% so overload is visible above the 100% line
  const yMax = Math.max(120, ...trend.map(t => Math.ceil(t.utilization_pct / 10) * 10 + 10));

  function pctToY(pct: number): number {
    return Math.min(CHART_H, (pct / yMax) * CHART_H);
  }

  function weekLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }

  function statusColor(pct: number): string {
    if (pct > 100) return 'bg-red-400';
    if (pct >= 80) return 'bg-amber-400';
    return 'bg-indigo-500';
  }

  const ref80Y = pctToY(80);
  const ref100Y = pctToY(100);

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Tendencia semanal de utilización</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        {trend.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">
              Aún no hay datos históricos suficientes.
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Los snapshots se generan automáticamente cada semana al cargar esta página.
            </p>
          </div>
        ) : (
          <>
            <div className="relative" style={{ height: `${CHART_H + 40}px` }}>
              {/* Reference line 100% */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-red-300 flex items-center"
                style={{ bottom: `${ref100Y + 24}px` }}
              >
                <span className="absolute right-0 text-[10px] text-red-400 font-semibold pr-1 -translate-y-full">100%</span>
              </div>
              {/* Reference line 80% */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-300"
                style={{ bottom: `${ref80Y + 24}px` }}
              >
                <span className="absolute right-0 text-[10px] text-amber-400 font-semibold pr-1 -translate-y-full">80%</span>
              </div>

              {/* Bars + labels */}
              <div className="absolute inset-0 flex items-end gap-1 pb-6">
                {trend.map((t) => {
                  const barH = pctToY(t.utilization_pct);
                  const color = statusColor(t.utilization_pct);
                  return (
                    <div
                      key={t.week_start}
                      className="flex-1 flex flex-col items-center justify-end gap-1"
                      style={{ height: `${CHART_H}px` }}
                    >
                      {/* % label above bar */}
                      <span className={clsx(
                        'text-[10px] font-semibold',
                        t.utilization_pct > 100 ? 'text-red-500' :
                        t.utilization_pct >= 80 ? 'text-amber-600' : 'text-indigo-600'
                      )}>
                        {t.utilization_pct.toFixed(0)}%
                      </span>
                      {/* Bar */}
                      <div
                        className={clsx('w-full rounded-t-md transition-all', color)}
                        style={{ height: `${Math.max(barH, 4)}px` }}
                        title={`Semana ${t.week_start}: ${t.utilization_pct.toFixed(0)}% — ${t.active_points} / ${t.capacity_points} pts`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Week labels below */}
              <div className="absolute bottom-0 left-0 right-0 flex gap-1" style={{ height: '20px' }}>
                {trend.map((t) => (
                  <div key={t.week_start} className="flex-1 text-center">
                    <span className="text-[9px] text-gray-400 leading-none">{weekLabel(t.week_start)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary table below chart */}
            <div className="mt-4 border-t border-gray-100 pt-4 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 font-medium pb-1.5 pr-3 whitespace-nowrap">Semana</th>
                    {trend.map(t => (
                      <th key={t.week_start} className="text-center text-gray-400 font-medium pb-1.5 px-1 whitespace-nowrap">
                        {weekLabel(t.week_start)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr>
                    <td className="text-gray-500 py-1.5 pr-3 whitespace-nowrap">Carga (pts)</td>
                    {trend.map(t => (
                      <td key={t.week_start} className="text-center text-gray-700 font-semibold py-1.5 px-1">
                        {t.active_points}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-gray-500 py-1.5 pr-3 whitespace-nowrap">Capacidad (pts)</td>
                    {trend.map(t => (
                      <td key={t.week_start} className="text-center text-gray-400 py-1.5 px-1">
                        {t.capacity_points}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-gray-500 py-1.5 pr-3 whitespace-nowrap">Vencidas</td>
                    {trend.map(t => (
                      <td key={t.week_start} className={clsx(
                        'text-center py-1.5 px-1 font-semibold',
                        t.overdue > 0 ? 'text-red-500' : 'text-gray-300'
                      )}>
                        {t.overdue > 0 ? t.overdue : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-indigo-500 rounded-sm inline-block" /> Normal (&lt;80%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-amber-400 rounded-sm inline-block" /> Alta (80–100%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-red-400 rounded-sm inline-block" /> Sobrecarga (&gt;100%)
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

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
        <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
      </div>
      <p className={clsx(
        'text-2xl font-bold',
        tone === 'overloaded' ? 'text-red-600' :
        tone === 'high' ? 'text-amber-600' : 'text-gray-900'
      )}>
        {value}
      </p>
    </div>
  );
}
