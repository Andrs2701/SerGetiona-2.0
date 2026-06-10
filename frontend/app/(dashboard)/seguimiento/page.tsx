'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  UserX,
  MessageSquare,
  Loader2,
  Hourglass,
  Lock,
  Bell,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import { ROLE_LABELS, ROLE_STATUS_LABELS } from '@/lib/types';
import type { Deliverable, RoleActivity, User } from '@/lib/types';
import PageHeader from '@/components/PageHeader';
import { TableSkeleton } from '@/components/LoadingSkeleton';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type TabKey = 'overdue' | 'approaching' | 'no_responsible' | 'observations' | 'pending_approval';

interface EnrichedActivity {
  activity: RoleActivity;
  deliverable: Deliverable;
  responsible?: User;
  daysOverdue: number;
  daysRemaining: number;
  daysWaiting: number;
}

interface KpiCounts {
  overdue: number;
  approaching: number;
  no_responsible: number;
  observations: number;
  pending_approval: number;
  blocked: number;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function daysDiff(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - d.getTime()) / 86400000);
}

function isOverdue(activity: RoleActivity): boolean {
  if (!activity.commitment_date) return false;
  if (activity.status === 'approved' || activity.status === 'not_applicable') return false;
  return daysDiff(activity.commitment_date) > 0;
}

function isApproaching(activity: RoleActivity): boolean {
  if (!activity.commitment_date) return false;
  if (activity.status === 'approved' || activity.status === 'not_applicable') return false;
  const diff = daysDiff(activity.commitment_date);
  return diff <= 0 && diff >= -3;
}

function isNoResponsible(activity: RoleActivity): boolean {
  return !activity.responsible && activity.status !== 'not_applicable';
}

function hasObservations(activity: RoleActivity): boolean {
  return activity.status === 'with_observations' || Boolean(activity.notes);
}

function isPendingApproval(activity: RoleActivity): boolean {
  return activity.status === 'delivered';
}

function isBlocked(activity: RoleActivity): boolean {
  return activity.status === 'adjustments_requested';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
      style={{ background: '#194276' }}
    >
      {getInitials(name)}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
      {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    delivered: 'bg-blue-100 text-blue-700',
    adjustments_requested: 'bg-orange-100 text-orange-700',
    with_observations: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    not_started: 'bg-gray-100 text-gray-600',
    in_development: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', colorMap[status] ?? 'bg-gray-100 text-gray-600')}>
      {ROLE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
        {message}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  active: boolean;
  onClick: () => void;
  subtitle?: string;
}

function KpiCard({ label, count, icon, color, active, onClick, subtitle }: KpiCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col gap-2 p-4 rounded-xl border text-left transition-all hover:shadow-md',
        active
          ? 'border-transparent shadow-md text-white'
          : 'bg-white border-gray-200 text-gray-800 hover:border-gray-300'
      )}
      style={active ? { background: '#194276' } : undefined}
    >
      <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', active ? 'bg-white/20' : color)}>
        {icon}
      </div>
      <div>
        <p className={clsx('text-2xl font-bold', active ? 'text-white' : 'text-gray-900')}>{count}</p>
        <p className={clsx('text-xs font-medium mt-0.5', active ? 'text-white/80' : 'text-gray-500')}>{label}</p>
        {subtitle && (
          <p className={clsx('text-[10px] mt-0.5', active ? 'text-white/60' : 'text-gray-400')}>{subtitle}</p>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────
function OverdueTable({
  items,
  onNotify,
}: {
  items: EnrichedActivity[];
  onNotify: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Responsable', 'Proyecto', 'Programa', 'Asignatura', 'Entregable', 'Etapa', 'F. Compromiso', 'Días Retraso', 'Acciones'].map(
              (h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.length === 0 ? (
            <EmptyRow message="No hay actividades vencidas" />
          ) : (
            items.map(({ activity, deliverable, daysOverdue }) => (
              <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5">
                  {activity.responsible ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={activity.responsible.name} />
                      <span className="text-xs text-gray-700 whitespace-nowrap">{activity.responsible.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Sin asignar</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[120px] truncate">{deliverable.project_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[120px] truncate">{deliverable.program_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[120px] truncate">{deliverable.subject_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs font-medium text-gray-800 max-w-[150px] truncate">{deliverable.name}</td>
                <td className="px-3 py-2.5">
                  <RoleBadge role={activity.role} />
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{activity.commitment_date ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                    {daysOverdue}d
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onNotify(activity.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <Bell size={11} />
                      Notificar
                    </button>
                    <a
                      href={`/entregables/${deliverable.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <Eye size={11} />
                      Ver
                    </a>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ApproachingTable({ items }: { items: EnrichedActivity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Responsable', 'Entregable', 'Etapa', 'F. Compromiso', 'Tiempo Restante', 'Estado'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.length === 0 ? (
            <EmptyRow message="No hay actividades por vencer en los próximos 3 días" />
          ) : (
            items.map(({ activity, deliverable, daysRemaining }) => (
              <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5">
                  {activity.responsible ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={activity.responsible.name} />
                      <span className="text-xs text-gray-700">{activity.responsible.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Sin asignar</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs font-medium text-gray-800 max-w-[180px] truncate">{deliverable.name}</td>
                <td className="px-3 py-2.5">
                  <RoleBadge role={activity.role} />
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{activity.commitment_date ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold',
                      daysRemaining === 0
                        ? 'bg-red-100 text-red-700'
                        : daysRemaining === 1
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-amber-100 text-amber-700'
                    )}
                  >
                    <Clock size={10} />
                    {daysRemaining === 0 ? 'Hoy' : `${daysRemaining}d`}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={activity.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function NoResponsibleTable({ items }: { items: EnrichedActivity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Proyecto', 'Programa', 'Asignatura', 'Entregable', 'Etapa sin asignar'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.length === 0 ? (
            <EmptyRow message="Todas las actividades tienen responsable asignado" />
          ) : (
            items.map(({ activity, deliverable }) => (
              <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[120px] truncate">{deliverable.project_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[120px] truncate">{deliverable.program_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[120px] truncate">{deliverable.subject_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs font-medium text-gray-800 max-w-[150px] truncate">{deliverable.name}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600">
                    <UserX size={10} />
                    {ROLE_LABELS[activity.role as keyof typeof ROLE_LABELS] ?? activity.role}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ObservationsTable({ items }: { items: EnrichedActivity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Responsable', 'Entregable', 'Observaciones', 'F. Compromiso'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.length === 0 ? (
            <EmptyRow message="No hay actividades con observaciones" />
          ) : (
            items.map(({ activity, deliverable }) => (
              <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5">
                  {activity.responsible ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={activity.responsible.name} />
                      <span className="text-xs text-gray-700">{activity.responsible.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Sin asignar</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs font-medium text-gray-800 max-w-[180px] truncate">{deliverable.name}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[240px]">
                  {activity.notes ? (
                    <span className="line-clamp-2">{activity.notes}</span>
                  ) : (
                    <span className="text-amber-600 font-medium">Estado: Con Observaciones</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{activity.commitment_date ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PendingApprovalTable({ items }: { items: EnrichedActivity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Responsable', 'Entregable', 'Etapa', 'F. Entrega', 'Esperando Aprobación'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.length === 0 ? (
            <EmptyRow message="No hay actividades pendientes de aprobación" />
          ) : (
            items.map(({ activity, deliverable, daysWaiting }) => (
              <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5">
                  {activity.responsible ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={activity.responsible.name} />
                      <span className="text-xs text-gray-700">{activity.responsible.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Sin asignar</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs font-medium text-gray-800 max-w-[180px] truncate">{deliverable.name}</td>
                <td className="px-3 py-2.5">
                  <RoleBadge role={activity.role} />
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                  {activity.actual_delivery_date ?? activity.commitment_date ?? '—'}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold',
                      daysWaiting > 5 ? 'bg-red-100 text-red-700' : daysWaiting > 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    )}
                  >
                    <Hourglass size={10} />
                    {daysWaiting}d
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function SeguimientoPage() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overdue');
  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Deliverable[]>(ENDPOINTS.DELIVERABLES)
      .then((data) => setDeliverables(Array.isArray(data) ? data : []))
      .catch(() => setDeliverables([]))
      .finally(() => setLoading(false));
  }, []);

  // Flatten all role_activities with their deliverable context
  const allActivities: EnrichedActivity[] = deliverables.flatMap((d) =>
    (d.role_activities ?? []).map((a) => {
      const overdueDays = a.commitment_date && daysDiff(a.commitment_date) > 0 ? daysDiff(a.commitment_date) : 0;
      const remainingDays = a.commitment_date ? Math.max(0, -daysDiff(a.commitment_date)) : 0;
      const waitingDays = a.actual_delivery_date ? daysDiff(a.actual_delivery_date) : 0;
      return {
        activity: a,
        deliverable: d,
        responsible: a.responsible,
        daysOverdue: overdueDays,
        daysRemaining: remainingDays,
        daysWaiting: Math.max(0, waitingDays),
      };
    })
  );

  const overdueItems = allActivities.filter(({ activity }) => isOverdue(activity));
  const approachingItems = allActivities.filter(({ activity }) => isApproaching(activity));
  const noResponsibleItems = allActivities.filter(({ activity }) => isNoResponsible(activity));
  const observationItems = allActivities.filter(({ activity }) => hasObservations(activity));
  const pendingApprovalItems = allActivities.filter(({ activity }) => isPendingApproval(activity));
  const blockedItems = allActivities.filter(({ activity }) => isBlocked(activity));

  const avgDelay =
    overdueItems.length > 0
      ? Math.round(overdueItems.reduce((s, i) => s + i.daysOverdue, 0) / overdueItems.length)
      : 0;

  const kpis: KpiCounts = {
    overdue: overdueItems.length,
    approaching: approachingItems.length,
    no_responsible: noResponsibleItems.length,
    observations: observationItems.length,
    pending_approval: pendingApprovalItems.length,
    blocked: blockedItems.length,
  };

  const handleNotify = useCallback(
    async (activityId: number) => {
      setNotifyingId(activityId);
      try {
        await api.post(ENDPOINTS.NOTIFICATIONS, {
          role_activity_id: activityId,
          type: 'overdue_reminder',
        });
        setToastMessage('Notificación enviada correctamente');
      } catch {
        setToastMessage('Error al enviar la notificación');
      } finally {
        setNotifyingId(null);
        setTimeout(() => setToastMessage(null), 3000);
      }
    },
    []
  );

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'overdue', label: 'Vencidas', count: kpis.overdue },
    { key: 'approaching', label: 'Por Vencer', count: kpis.approaching },
    { key: 'no_responsible', label: 'Sin Responsable', count: kpis.no_responsible },
    { key: 'observations', label: 'Con Observaciones', count: kpis.observations },
    { key: 'pending_approval', label: 'Pendientes Aprobación', count: kpis.pending_approval },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Centro de Seguimiento"
        subtitle="Monitoreo de riesgo y actividades críticas en todos los proyectos"
      />

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <Bell size={14} />
          {toastMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Actividades Vencidas"
          count={kpis.overdue}
          icon={<AlertTriangle size={18} className="text-red-600" />}
          color="bg-red-50"
          active={activeTab === 'overdue'}
          onClick={() => setActiveTab('overdue')}
          subtitle={avgDelay > 0 ? `Prom. ${avgDelay}d retraso` : undefined}
        />
        <KpiCard
          label="Por Vencer (≤3 días)"
          count={kpis.approaching}
          icon={<Clock size={18} className="text-amber-500" />}
          color="bg-amber-50"
          active={activeTab === 'approaching'}
          onClick={() => setActiveTab('approaching')}
        />
        <KpiCard
          label="Sin Responsable"
          count={kpis.no_responsible}
          icon={<UserX size={18} className="text-gray-500" />}
          color="bg-gray-100"
          active={activeTab === 'no_responsible'}
          onClick={() => setActiveTab('no_responsible')}
        />
        <KpiCard
          label="Con Observaciones"
          count={kpis.observations}
          icon={<MessageSquare size={18} className="text-orange-500" />}
          color="bg-orange-50"
          active={activeTab === 'observations'}
          onClick={() => setActiveTab('observations')}
        />
        <KpiCard
          label="Pend. Aprobación"
          count={kpis.pending_approval}
          icon={<Hourglass size={18} className="text-blue-500" />}
          color="bg-blue-50"
          active={activeTab === 'pending_approval'}
          onClick={() => setActiveTab('pending_approval')}
        />
        <KpiCard
          label="Bloqueadas"
          count={kpis.blocked}
          icon={<Lock size={18} className="text-gray-400" />}
          color="bg-gray-100"
          active={false}
          onClick={() => {}}
        />
      </div>

      {/* Table section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                activeTab === key
                  ? 'border-[#194276] text-[#194276] bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              {label}
              {count > 0 && (
                <span
                  className={clsx(
                    'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                    activeTab === key ? 'bg-[#194276] text-white' : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center pr-4 text-xs text-gray-400">
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Table content */}
        <div className="min-h-[300px]">
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={6} />
            </div>
          ) : notifyingId !== null ? (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              Enviando notificación...
            </div>
          ) : (
            <>
              {activeTab === 'overdue' && <OverdueTable items={overdueItems} onNotify={handleNotify} />}
              {activeTab === 'approaching' && <ApproachingTable items={approachingItems} />}
              {activeTab === 'no_responsible' && <NoResponsibleTable items={noResponsibleItems} />}
              {activeTab === 'observations' && <ObservationsTable items={observationItems} />}
              {activeTab === 'pending_approval' && <PendingApprovalTable items={pendingApprovalItems} />}
            </>
          )}
        </div>

        {/* Footer count */}
        {!loading && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {TABS.find((t) => t.key === activeTab)?.count ?? 0} registro(s) encontrado(s)
          </div>
        )}
      </div>
    </div>
  );
}
