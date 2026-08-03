'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Calendar, Clock,
  XCircle, CheckCircle2, AlertTriangle, ExternalLink,
  LayoutGrid, Users, Plus, Eye, Pencil,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { WorkspaceActivity, CalendarEvent, Role } from '@/lib/types';
import { ROLE_STATUS_LABELS, ROLE_LABELS } from '@/lib/types';
import { COMPLETED_STATUSES } from '@/lib/statusGroups';
import { useAuthContext } from '@/contexts/AuthContext';
import { can } from '@/lib/permissions';
import Modal from '@/components/Modal';

const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEvent['type'], string> = {
  holiday: 'Festivo',
  non_working: 'Día no laboral',
  vacation: 'Vacaciones',
  closure: 'Cierre institucional',
  event: 'Evento',
};

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type ViewMode = 'mes' | 'semana' | 'dia';

// ─── AllActivity type ─────────────────────────────────────────────────────────
interface AllActivity {
  id: number;
  deliverable_id: number;
  deliverable_name: string;
  role: Role;
  role_label: string;
  responsible_id?: number;
  responsible_name?: string;
  commitment_date: string | null;
  actual_delivery_date?: string;
  status: string;
  date_status: string;
  program_name: string;
  subject_name: string;
  project_id: number;
  project_name?: string;
}

// ─── CalendarDecision type ────────────────────────────────────────────────────
interface CalendarDecision {
  id: number;
  description: string;
  due_date: string;
  status: string;
  impact: string;
  project_name?: string;
  program_name?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function getDayLabel(d: Date): string {
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// ─── Event styling ────────────────────────────────────────────────────────────
function activityChipClass(act: WorkspaceActivity): string {
  if (act.status === 'approved') return 'bg-emerald-100 text-emerald-700 border-l-2 border-emerald-400';
  if (act.date_status === 'overdue') return 'bg-red-100 text-red-700 border-l-2 border-red-400';
  if (['in_review', 'delivered'].includes(act.status)) return 'bg-purple-100 text-purple-700 border-l-2 border-purple-400';
  return 'bg-indigo-100 text-indigo-700 border-l-2 border-indigo-400';
}

function activityDotClass(act: WorkspaceActivity): string {
  if (act.status === 'approved') return 'bg-emerald-500';
  if (act.date_status === 'overdue') return 'bg-red-500';
  if (['in_review', 'delivered'].includes(act.status)) return 'bg-purple-500';
  return 'bg-indigo-500';
}

function activityStatusLabel(act: WorkspaceActivity): string {
  if (act.status === 'approved') return 'Aprobada';
  if (act.date_status === 'overdue') return 'Vencida';
  if (act.date_status === 'approaching') return 'Por vencer';
  return ROLE_STATUS_LABELS[act.status] ?? act.status;
}

function activityStatusBadgeClass(act: WorkspaceActivity): string {
  if (act.status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (act.date_status === 'overdue') return 'bg-red-100 text-red-700';
  if (act.date_status === 'approaching') return 'bg-amber-100 text-amber-700';
  if (['in_review', 'delivered'].includes(act.status)) return 'bg-purple-100 text-purple-700';
  return 'bg-indigo-100 text-indigo-700';
}

// ─── AllActivity helpers ──────────────────────────────────────────────────────
function allActivityChipColor(a: AllActivity, _todayStr: string): string {
  if (a.status === 'approved') return 'bg-emerald-100 text-emerald-700 border-l-2 border-emerald-400';
  if (a.date_status === 'overdue') return 'bg-red-100 text-red-700 border-l-2 border-red-400';
  if (a.date_status === 'approaching') return 'bg-amber-100 text-amber-700 border-l-2 border-amber-400';
  return 'bg-blue-100 text-blue-700 border-l-2 border-blue-400';
}

function allActivityStatusBadge(a: AllActivity, _todayStr: string): { label: string; cls: string } {
  if (a.status === 'approved') return { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700' };
  if (a.date_status === 'overdue') return { label: 'Vencida', cls: 'bg-red-100 text-red-700' };
  if (a.date_status === 'approaching') return { label: 'Urgente', cls: 'bg-amber-100 text-amber-700' };
  return { label: ROLE_STATUS_LABELS[a.status] ?? a.status, cls: 'bg-blue-100 text-blue-700' };
}

// ─── Decision chip styling — distinta de festivos (ámbar) y actividades (índigo/azul) ──
function decisionChipClass(d: CalendarDecision): string {
  const overdue = d.status !== 'implemented' && d.status !== 'cancelled' && daysUntil(d.due_date) < 0;
  return overdue
    ? 'bg-red-100 text-red-700 border-l-2 border-red-400'
    : 'bg-violet-100 text-violet-700 border-l-2 border-violet-400';
}

// ─── Activity card (my activities) ────────────────────────────────────────────
function ActivityCard({
  act,
  onNavigate,
  onEdit,
}: {
  act: WorkspaceActivity;
  onNavigate: (id: number) => void;
  onEdit: (activityId: number, deliverableId?: number) => void;
}) {
  const days = act.commitment_date ? daysUntil(act.commitment_date) : null;
  const isVencida = act.date_status === 'overdue';
  const isUrgente = days !== null && days >= 0 && days <= 3 && !isVencida;

  return (
    <div
      onClick={() => onEdit(act.id, act.deliverable?.id)}
      className="border border-gray-100 rounded-lg p-3 space-y-1.5 hover:border-indigo-200 hover:bg-indigo-50/5 cursor-pointer transition-all hover:shadow-sm"
      title="Haz clic para ver/editar esta entrega"
    >
      <p className="text-sm font-semibold text-gray-900 leading-snug">{act.deliverable?.name ?? '—'}</p>
      <p className="text-xs text-gray-500">{act.program?.name ?? '—'}</p>
      <p className="text-xs text-gray-400">{act.subject?.name ?? '—'}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', activityStatusBadgeClass(act))}>
          {activityStatusLabel(act)}
        </span>
        {isVencida && (
          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-bold bg-red-500 text-white">
            Vencida
          </span>
        )}
        {isUrgente && (
          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-bold bg-amber-500 text-white">
            Urgente
          </span>
        )}
        {act.commitment_date && (
          <span className="text-xs text-gray-400">
            {new Date(act.commitment_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      {act.project && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(act.project!.id);
          }}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold pt-0.5 hover:underline"
        >
          <ExternalLink size={11} /> Ver proyecto
        </button>
      )}
    </div>
  );
}

// ─── AllActivity card (showAll mode) ─────────────────────────────────────────
function AllActivityCard({
  a,
  todayStr,
  onNavigate,
  onView,
  onEdit,
}: {
  a: AllActivity;
  todayStr: string;
  onNavigate: (id: number) => void;
  onView: (activityId: number, deliverableId?: number) => void;
  onEdit: (activityId: number, deliverableId?: number) => void;
}) {
  const badge = allActivityStatusBadge(a, todayStr);
  const initial = a.responsible_name ? a.responsible_name.charAt(0).toUpperCase() : '?';

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-1.5 hover:shadow-sm transition-all">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-[#194276] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {initial}
        </span>
        <p className="text-sm font-semibold text-gray-900 leading-snug truncate flex-1">{a.deliverable_name}</p>
      </div>
      {a.responsible_name && (
        <p className="text-xs text-gray-500">Responsable: <strong>{a.responsible_name}</strong></p>
      )}
      <p className="text-xs text-gray-500">{a.program_name}</p>
      <p className="text-xs text-gray-400">{a.subject_name} · {a.role_label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', badge.cls)}>
          {badge.label}
        </span>
        {a.commitment_date && (
          <span className="text-xs text-gray-400">
            {new Date(a.commitment_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap pt-0.5">
        <button
          onClick={() => onView(a.id, a.deliverable_id)}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-semibold hover:underline"
        >
          <Eye size={11} /> Ver entrega
        </button>
        <button
          onClick={() => onEdit(a.id, a.deliverable_id)}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
        >
          <Pencil size={11} /> Editar entrega
        </button>
        {a.project_id > 0 && (
          <button
            onClick={() => onNavigate(a.project_id)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-semibold hover:underline"
          >
            <ExternalLink size={11} /> Ver proyecto
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────
function SidePanel({
  activities,
  today,
  onNavigate,
  onEdit,
}: {
  activities: WorkspaceActivity[];
  today: Date;
  onNavigate: (id: number) => void;
  onEdit: (activityId: number, deliverableId?: number) => void;
}) {
  const todayStr = toYMD(today);

  const upcoming = useMemo(() => {
    return activities
      .filter((a) => a.status !== 'approved' && a.commitment_date && a.commitment_date >= todayStr)
      .sort((a, b) => (a.commitment_date! > b.commitment_date! ? 1 : -1))
      .slice(0, 5);
  }, [activities, todayStr]);

  const overdueList = useMemo(() => activities.filter((a) => a.date_status === 'overdue'), [activities]);

  const { weekScheduled, weekDone } = useMemo(() => {
    const ws = startOfWeek(today);
    const we = addDays(ws, 6);
    const wsStr = toYMD(ws);
    const weStr = toYMD(we);
    // Misma definición que el backend: las "No Aplica" salen del denominador
    // (no son trabajo), y el numerador cuenta lo entregado sin esperar a que
    // Calidad apruebe.
    const scheduled = activities.filter(
      (a) => a.commitment_date && a.commitment_date >= wsStr && a.commitment_date <= weStr
        && a.status !== 'not_applicable'
    );
    const done = scheduled.filter((a) => COMPLETED_STATUSES.includes(a.status));
    return { weekScheduled: scheduled.length, weekDone: done.length };
  }, [activities, today]);

  const weekCompliance = weekScheduled > 0 ? Math.round((weekDone / weekScheduled) * 100) : 0;

  return (
    <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
      {/* Próximos vencimientos */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Clock size={14} className="text-indigo-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Próximos vencimientos</h3>
        </div>
        <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
          {upcoming.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Sin vencimientos próximos</p>
          ) : (
            upcoming.map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors"
                onClick={() => onEdit(act.id, act.deliverable?.id)}
              >
                <span className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', activityDotClass(act))} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{act.deliverable?.name ?? '—'}</p>
                  <p className="text-xs text-gray-500">
                    {act.commitment_date
                      ? new Date(act.commitment_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                      : '—'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Actividades críticas */}
      {overdueList.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200">
          <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            <h3 className="font-semibold text-red-800 text-sm">Actividades críticas ({overdueList.length})</h3>
          </div>
          <div className="p-3 space-y-2 max-h-52 overflow-y-auto">
            {overdueList.map((act) => (
              <div
                key={act.id}
                className="p-2 rounded-lg bg-red-50 hover:bg-red-100/50 cursor-pointer transition-colors"
                onClick={() => onEdit(act.id, act.deliverable?.id)}
              >
                <p className="text-xs font-medium text-red-800 truncate">{act.deliverable?.name ?? '—'}</p>
                <p className="text-xs text-red-500">{act.subject?.name ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen semanal */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Calendar size={14} className="text-emerald-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Resumen semanal</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Programadas esta semana</span>
            <span className="font-semibold text-gray-900">{weekScheduled}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Realizadas esta semana</span>
            <span className="font-semibold text-emerald-700">{weekDone}</span>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Cumplimiento de esta semana</span>
              {weekScheduled > 0 ? (
                <span className={clsx(
                  'font-bold',
                  weekCompliance >= 80 ? 'text-emerald-600' : weekCompliance >= 50 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {weekCompliance}%
                </span>
              ) : (
                <span className="text-gray-400 text-xs italic">Sin actividades esta semana</span>
              )}
            </div>
            {weekScheduled > 0 && (
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-2 rounded-full transition-all',
                    weekCompliance >= 80 ? 'bg-emerald-500' : weekCompliance >= 50 ? 'bg-amber-400' : 'bg-red-400'
                  )}
                  style={{ width: `${weekCompliance}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Leyenda</p>
        <div className="space-y-1.5">
          {[
            { cls: 'bg-indigo-400', label: 'Entrega pendiente' },
            { cls: 'bg-red-400', label: 'Vencida' },
            { cls: 'bg-purple-400', label: 'En revisión' },
            { cls: 'bg-emerald-400', label: 'Aprobada' },
            { cls: 'bg-amber-400', label: 'Festivo / Urgente' },
            { cls: 'bg-violet-400', label: 'Decisión asignada' },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={clsx('w-2.5 h-2.5 rounded-sm flex-shrink-0', cls)} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MONTH VIEW ───────────────────────────────────────────────────────────────
function MonthView({
  year,
  month,
  actByDate,
  allActByDate,
  eventByDate,
  decisionsByDate,
  todayStr,
  selectedDay,
  onSelectDay,
  showAll,
}: {
  year: number;
  month: number;
  actByDate: Record<string, WorkspaceActivity[]>;
  allActByDate: Record<string, AllActivity[]>;
  eventByDate: Record<string, CalendarEvent[]>;
  decisionsByDate: Record<string, CalendarDecision[]>;
  todayStr: string;
  selectedDay: string | null;
  onSelectDay: (d: string | null) => void;
  showAll: boolean;
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const cells: Array<Date | null> = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    cells.push(dayNum < 1 || dayNum > lastDay.getDate() ? null : new Date(year, month, dayNum));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAYS_SHORT.map((wd) => (
          <div key={wd} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, idx) => {
          const key = date ? toYMD(date) : `empty-${idx}`;
          const dayActs = showAll ? [] : (date ? (actByDate[key] ?? []) : []);
          const dayAllActs = showAll ? (date ? (allActByDate[key] ?? []) : []) : [];
          const dayEvts = date ? (eventByDate[key] ?? []) : [];
          const dayDecisions = date ? (decisionsByDate[key] ?? []) : [];
          const isToday = date ? key === todayStr : false;
          const isSelected = key === selectedDay;

          const visibleActs = dayActs.slice(0, 2);
          const visibleAllActs = dayAllActs.slice(0, 2);
          const overflow = showAll
            ? dayAllActs.length > 2 ? dayAllActs.length - 2 : 0
            : dayActs.length > 2 ? dayActs.length - 2 : 0;

          return (
            <div
              key={key}
              onClick={() => date && onSelectDay(isSelected ? null : key)}
              className={clsx(
                'min-h-[90px] border-b border-r border-gray-100 p-1.5 transition-colors',
                date ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04]' : 'bg-gray-50/50 dark:bg-white/[0.02]',
                isToday && 'bg-indigo-50',
                isSelected && 'ring-2 ring-inset ring-indigo-400',
                dayEvts.length > 0 && !isToday && !isSelected && 'bg-amber-50/30 dark:bg-amber-900/10'
              )}
            >
              {date && (
                <>
                  <div className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1',
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
                  )}>
                    {date.getDate()}
                  </div>
                  {dayEvts.map((ev) => (
                    <div key={ev.id} className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium rounded px-1 mb-0.5 truncate">
                      {ev.name}
                    </div>
                  ))}
                  {dayDecisions.map((d) => (
                    <div
                      key={`decision-${d.id}`}
                      className={clsx('text-[10px] rounded px-1 mb-0.5 truncate', decisionChipClass(d))}
                      title={`Decisión: ${d.description}`}
                    >
                      {d.description.length > 14 ? d.description.slice(0, 14) + '…' : d.description}
                    </div>
                  ))}
                  {/* showAll mode: AllActivity chips */}
                  {showAll
                    ? visibleAllActs.map((a) => {
                        const initial = a.responsible_name ? a.responsible_name.charAt(0).toUpperCase() : '?';
                        const chipCls = allActivityChipColor(a, todayStr);
                        return (
                          <div
                            key={`${a.id}-${a.role}`}
                            className={clsx('text-[10px] rounded px-1 mb-0.5 flex items-center gap-0.5', chipCls)}
                            title={`${a.deliverable_name} (${a.responsible_name ?? 'Sin asignar'})`}
                          >
                            <span className="w-3 h-3 rounded-full bg-current opacity-60 flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white">
                              {initial}
                            </span>
                            <span className="truncate">
                              {a.deliverable_name.length > 11
                                ? a.deliverable_name.slice(0, 11) + '…'
                                : a.deliverable_name}
                            </span>
                          </div>
                        );
                      })
                    : visibleActs.map((act) => (
                        <div
                          key={act.id}
                          className={clsx('text-[10px] rounded px-1 mb-0.5 truncate', activityChipClass(act))}
                          title={act.deliverable?.name ?? '—'}
                        >
                          {act.deliverable
                            ? act.deliverable.name.length > 14
                              ? act.deliverable.name.slice(0, 14) + '…'
                              : act.deliverable.name
                            : '—'}
                        </div>
                      ))}
                  {overflow > 0 && (
                    <div className="text-[10px] text-indigo-500 font-medium px-1">+{overflow} más</div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── WEEK VIEW ────────────────────────────────────────────────────────────────
function WeekView({
  weekStart,
  actByDate,
  allActByDate,
  eventByDate,
  decisionsByDate,
  todayStr,
  onSelectDay,
  showAll,
}: {
  weekStart: Date;
  actByDate: Record<string, WorkspaceActivity[]>;
  allActByDate: Record<string, AllActivity[]>;
  eventByDate: Record<string, CalendarEvent[]>;
  decisionsByDate: Record<string, CalendarDecision[]>;
  todayStr: string;
  onSelectDay: (d: string) => void;
  showAll: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {days.map((d) => {
          const key = toYMD(d);
          const isToday = key === todayStr;
          return (
            <div
              key={key}
              className={clsx(
                'p-2 text-center cursor-pointer hover:bg-gray-50 transition-colors',
                isToday && 'bg-indigo-50'
              )}
              onClick={() => onSelectDay(key)}
            >
              <p className="text-xs text-gray-500 uppercase tracking-wide">{WEEKDAYS_SHORT[d.getDay()]}</p>
              <p className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mx-auto mt-0.5',
                isToday ? 'bg-indigo-600 text-white' : 'text-gray-800'
              )}>
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((d) => {
          const key = toYMD(d);
          const dayActs = showAll ? [] : (actByDate[key] ?? []);
          const dayAllActs = showAll ? (allActByDate[key] ?? []) : [];
          const dayEvts = eventByDate[key] ?? [];
          const dayDecisions = decisionsByDate[key] ?? [];
          const isToday = key === todayStr;

          return (
            <div
              key={key}
              className={clsx(
                'border-r border-gray-100 last:border-r-0 p-2 min-h-[400px] cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.04] transition-colors',
                isToday && 'bg-indigo-50/30 dark:bg-indigo-900/15'
              )}
              onClick={() => onSelectDay(key)}
            >
              {dayEvts.map((ev) => (
                <div key={ev.id} className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium rounded px-1.5 py-0.5 mb-1 truncate">
                  {ev.name}
                </div>
              ))}
              {dayDecisions.map((d) => (
                <div
                  key={`decision-${d.id}`}
                  className={clsx('text-[10px] rounded px-1.5 py-0.5 mb-1 truncate', decisionChipClass(d))}
                  title={`Decisión: ${d.description}`}
                >
                  {d.description.length > 16 ? d.description.slice(0, 16) + '…' : d.description}
                </div>
              ))}
              {showAll
                ? dayAllActs.map((a) => {
                    const chipCls = allActivityChipColor(a, todayStr);
                    return (
                      <div
                        key={`${a.id}-${a.role}`}
                        className={clsx('text-[10px] rounded px-1.5 py-0.5 mb-1 truncate', chipCls)}
                        title={`${a.deliverable_name} · ${a.responsible_name ?? ''}`}
                      >
                        {a.deliverable_name.length > 16
                          ? a.deliverable_name.slice(0, 16) + '…'
                          : a.deliverable_name}
                      </div>
                    );
                  })
                : dayActs.map((act) => (
                    <div
                      key={act.id}
                      className={clsx('text-[10px] rounded px-1.5 py-0.5 mb-1 truncate', activityChipClass(act))}
                      title={act.deliverable?.name ?? '—'}
                    >
                      {act.deliverable
                        ? act.deliverable.name.length > 16
                          ? act.deliverable.name.slice(0, 16) + '…'
                          : act.deliverable.name
                        : '—'}
                    </div>
                  ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DAY VIEW ─────────────────────────────────────────────────────────────────
function DayView({
  date,
  actByDate,
  allActByDate,
  eventByDate,
  decisionsByDate,
  onNavigate,
  onView,
  onEdit,
  showAll,
  todayStr,
}: {
  date: Date;
  actByDate: Record<string, WorkspaceActivity[]>;
  allActByDate: Record<string, AllActivity[]>;
  eventByDate: Record<string, CalendarEvent[]>;
  decisionsByDate: Record<string, CalendarDecision[]>;
  onNavigate: (id: number) => void;
  onView: (activityId: number, deliverableId?: number) => void;
  onEdit: (activityId: number, deliverableId?: number) => void;
  showAll: boolean;
  todayStr: string;
}) {
  const key = toYMD(date);
  const dayActs = showAll ? [] : (actByDate[key] ?? []);
  const dayAllActs = showAll ? (allActByDate[key] ?? []) : [];
  const dayEvts = eventByDate[key] ?? [];
  const dayDecisions = decisionsByDate[key] ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{getDayLabel(date)}</h2>
      </div>
      <div className="p-6">
        {dayEvts.length === 0 && dayActs.length === 0 && dayAllActs.length === 0 && dayDecisions.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Sin actividades ni eventos para este día.</p>
        )}
        {dayEvts.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Eventos del día</p>
            <div className="space-y-2">
              {dayEvts.map((ev) => (
                <div key={ev.id} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="font-medium text-amber-800 text-sm">{ev.name}</p>
                  {ev.description && <p className="text-xs text-amber-600 mt-0.5">{ev.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {dayDecisions.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Decisiones asignadas a mí ({dayDecisions.length})
            </p>
            <div className="space-y-2">
              {dayDecisions.map((d) => (
                <div key={d.id} className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
                  <p className="font-medium text-violet-800 text-sm">{d.description}</p>
                  <p className="text-xs text-violet-500 mt-0.5">
                    {[d.project_name, d.program_name].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {!showAll && dayActs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Mis actividades ({dayActs.length})
            </p>
            <div className="space-y-3">
              {dayActs.map((act) => (
                <ActivityCard key={act.id} act={act} onNavigate={onNavigate} onEdit={onEdit} />
              ))}
            </div>
          </div>
        )}
        {showAll && dayAllActs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Todas las actividades ({dayAllActs.length})
            </p>
            <div className="space-y-3">
              {dayAllActs.map((a) => (
                <AllActivityCard key={`${a.id}-${a.role}`} a={a} todayStr={todayStr} onNavigate={onNavigate} onView={onView} onEdit={onEdit} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Selected day detail (inline below month grid) ────────────────────────────
function SelectedDayPanel({
  selectedDay,
  actByDate,
  allActByDate,
  eventByDate,
  decisionsByDate,
  onNavigate,
  onView,
  onEdit,
  onClose,
  showAll,
  todayStr,
}: {
  selectedDay: string;
  actByDate: Record<string, WorkspaceActivity[]>;
  allActByDate: Record<string, AllActivity[]>;
  eventByDate: Record<string, CalendarEvent[]>;
  decisionsByDate: Record<string, CalendarDecision[]>;
  onNavigate: (id: number) => void;
  onView: (activityId: number, deliverableId?: number) => void;
  onEdit: (activityId: number, deliverableId?: number) => void;
  onClose: () => void;
  showAll: boolean;
  todayStr: string;
}) {
  const dayActs = showAll ? [] : (actByDate[selectedDay] ?? []);
  const dayAllActs = showAll ? (allActByDate[selectedDay] ?? []) : [];
  const dayEvts = eventByDate[selectedDay] ?? [];
  const dayDecisions = decisionsByDate[selectedDay] ?? [];
  const d = new Date(selectedDay + 'T12:00:00');

  return (
    <div className="bg-white rounded-xl border border-indigo-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">
          {d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
      </div>
      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
        {dayEvts.map((ev) => (
          <div key={ev.id} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <p className="font-medium text-amber-800 text-sm">{ev.name}</p>
            {ev.description && <p className="text-xs text-amber-500 mt-0.5">{ev.description}</p>}
          </div>
        ))}
        {dayDecisions.map((dec) => (
          <div key={dec.id} className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
            <p className="font-medium text-violet-800 text-sm">{dec.description}</p>
            <p className="text-xs text-violet-500 mt-0.5">
              {[dec.project_name, dec.program_name].filter(Boolean).join(' · ')}
            </p>
          </div>
        ))}
        {!showAll && dayActs.map((act) => (
          <ActivityCard key={act.id} act={act} onNavigate={onNavigate} onEdit={onEdit} />
        ))}
        {showAll && dayAllActs.map((a) => (
          <AllActivityCard key={`${a.id}-${a.role}`} a={a} todayStr={todayStr} onNavigate={onNavigate} onView={onView} onEdit={onEdit} />
        ))}
        {dayActs.length === 0 && dayAllActs.length === 0 && dayEvts.length === 0 && dayDecisions.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Sin actividades.</p>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CalendarioPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const isAdminOrCoord = user?.role === 'admin' || user?.role === 'coordinator';
  // Además de admin/coordinator, un rol al que la Matriz de Permisos le otorgue
  // "calendario.view_all" puede ver y navegar por las entregas de todo el equipo.
  const canViewAllCalendar = isAdminOrCoord || can(user, 'calendario', 'view_all');

  const navigate = (projectId: number) => {
    if (canViewAllCalendar) {
      router.push('/programas');
    } else {
      router.push('/mi-espacio');
    }
  };

  // "Ver entrega" — abre el panel de solo lectura (info + línea de tiempo).
  const handleView = (activityId: number, deliverableId?: number) => {
    if (canViewAllCalendar) {
      if (deliverableId) {
        router.push(`/entregables?deliverable=${deliverableId}`);
      } else {
        router.push('/entregables');
      }
    } else {
      router.push(`/mi-espacio?open=${activityId}`);
    }
  };

  // "Editar entrega" — edit=1 abre directo el formulario de edición (info,
  // responsable y fechas por rol) en vez del panel de solo lectura.
  const handleEdit = (activityId: number, deliverableId?: number) => {
    if (canViewAllCalendar) {
      if (deliverableId) {
        router.push(`/entregables?deliverable=${deliverableId}&edit=1`);
      } else {
        router.push('/entregables');
      }
    } else {
      router.push(`/mi-espacio?open=${activityId}`);
    }
  };
  const today = useMemo(() => new Date(), []);
  const todayStr = toYMD(today);

  const [view, setView] = useState<ViewMode>('mes');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(today));
  const [dayDate, setDayDate] = useState<Date>(() => new Date(today));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Toggle: mis actividades vs todas
  const [showAll, setShowAll] = useState(false);

  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [allActivitiesDirect, setAllActivitiesDirect] = useState<AllActivity[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [decisions, setDecisions] = useState<CalendarDecision[]>([]);

  // My activities
  useEffect(() => {
    api
      .get<WorkspaceActivity[]>(ENDPOINTS.CALENDAR_MY_DELIVERABLES)
      .then(setActivities)
      .catch(() => setActivities([]));
  }, []);

  // Decisiones asignadas a mí con fecha límite — cualquier rol
  useEffect(() => {
    api
      .get<CalendarDecision[]>(ENDPOINTS.CALENDAR_MY_DECISIONS)
      .then((data) => setDecisions(Array.isArray(data) ? data : []))
      .catch(() => setDecisions([]));
  }, []);

  // Calendar events
  const loadEvents = useCallback(() => {
    api
      .get<CalendarEvent[]>(`${ENDPOINTS.CALENDAR_EVENTS}?year=${year}`)
      .then(setCalEvents)
      .catch(() => setCalEvents([]));
  }, [year]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Modal: agregar festivo
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayError, setHolidayError] = useState('');
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'holiday' as CalendarEvent['type'], description: '', is_recurring: false });

  async function handleSaveHoliday() {
    if (!holidayForm.name.trim() || !holidayForm.date) return;
    setHolidaySaving(true);
    setHolidayError('');
    try {
      await api.post(ENDPOINTS.CALENDAR_EVENTS, {
        name: holidayForm.name.trim(),
        date: holidayForm.date,
        type: holidayForm.type,
        description: holidayForm.description.trim() || null,
        is_recurring: holidayForm.is_recurring,
      });
      setShowHolidayModal(false);
      setHolidayForm({ name: '', date: '', type: 'holiday', description: '', is_recurring: false });
      loadEvents();
    } catch {
      setHolidayError('No se pudo guardar el festivo. Intenta de nuevo.');
    } finally {
      setHolidaySaving(false);
    }
  }

  // All activities (showAll mode) — uses dedicated endpoint
  useEffect(() => {
    if (!showAll || !canViewAllCalendar) return;
    setLoadingAll(true);
    api.get<AllActivity[]>(ENDPOINTS.CALENDAR_ALL_ACTIVITIES)
      .then((data) => setAllActivitiesDirect(Array.isArray(data) ? data : []))
      .catch(() => setAllActivitiesDirect([]))
      .finally(() => setLoadingAll(false));
  }, [showAll, canViewAllCalendar]);

  const allActivities = allActivitiesDirect;

  const actByDate = useMemo(() => {
    const map: Record<string, WorkspaceActivity[]> = {};
    for (const act of activities) {
      if (act.commitment_date) {
        const key = act.commitment_date.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(act);
      }
    }
    return map;
  }, [activities]);

  const allActByDate = useMemo(() => {
    const map: Record<string, AllActivity[]> = {};
    for (const a of allActivities) {
      if (!a.commitment_date) continue;
      const key = a.commitment_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [allActivities]);

  const eventByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of calEvents) {
      const key = ev.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [calEvents]);

  const decisionsByDate = useMemo(() => {
    const map: Record<string, CalendarDecision[]> = {};
    for (const d of decisions) {
      const key = d.due_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    return map;
  }, [decisions]);

  function prevPeriod() {
    if (view === 'mes') {
      if (month === 0) { setMonth(11); setYear((y) => y - 1); }
      else setMonth((m) => m - 1);
    } else if (view === 'semana') {
      setWeekStart((ws) => addDays(ws, -7));
    } else if (view === 'dia') {
      setDayDate((d) => addDays(d, -1));
    }
  }

  function nextPeriod() {
    if (view === 'mes') {
      if (month === 11) { setMonth(0); setYear((y) => y + 1); }
      else setMonth((m) => m + 1);
    } else if (view === 'semana') {
      setWeekStart((ws) => addDays(ws, 7));
    } else if (view === 'dia') {
      setDayDate((d) => addDays(d, 1));
    }
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setWeekStart(startOfWeek(today));
    setDayDate(new Date(today));
  }

  function handleSelectDay(key: string | null) {
    if (view === 'mes') {
      setSelectedDay(key);
    } else if (view === 'semana' && key) {
      setDayDate(new Date(key + 'T12:00:00'));
      setView('dia');
    }
  }

  const periodLabel = useMemo(() => {
    if (view === 'mes') return `${MONTHS[month]} ${year}`;
    if (view === 'semana') {
      const end = addDays(weekStart, 6);
      if (weekStart.getMonth() === end.getMonth()) {
        return `${weekStart.getDate()}–${end.getDate()} ${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
      }
      return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
    }
    if (view === 'dia') return getDayLabel(dayDate);
    return '';
  }, [view, month, year, weekStart, dayDate]);

  const viewTabs: Array<{ id: ViewMode; icon: React.ReactNode; label: string }> = [
    { id: 'mes', icon: <Calendar size={14} />, label: 'Mes' },
    { id: 'semana', icon: <LayoutGrid size={14} />, label: 'Semana' },
    { id: 'dia', icon: <Clock size={14} />, label: 'Día' },
  ];

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendario</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Toggle mis actividades / todas */}
          {canViewAllCalendar && (
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-sm">
              <button
                onClick={() => setShowAll(false)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors',
                  !showAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Mis actividades
              </button>
              <button
                onClick={() => setShowAll(true)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors',
                  showAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Users size={13} />
                Todas
                {loadingAll && (
                  <span className="ml-1 w-3 h-3 rounded-full border-2 border-[#194276] border-t-transparent animate-spin" />
                )}
              </button>
            </div>
          )}

          {/* View selector */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 text-sm">
            {viewTabs.map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors',
                  view === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {isAdminOrCoord && (
            <button
              onClick={() => setShowHolidayModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg"
              style={{ background: '#194276' }}
            >
              <Plus size={14} /> Agregar festivo
            </button>
          )}
        </div>
      </div>

      <Modal
        open={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        title="Agregar festivo"
        footer={
          <>
            <button
              onClick={() => setShowHolidayModal(false)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveHoliday}
              disabled={holidaySaving || !holidayForm.name.trim() || !holidayForm.date}
              className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
              style={{ background: '#194276' }}
            >
              {holidaySaving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {holidayError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{holidayError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              value={holidayForm.name}
              onChange={e => setHolidayForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej. Día de la Independencia"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={holidayForm.date}
                onChange={e => setHolidayForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={holidayForm.type}
                onChange={e => setHolidayForm(f => ({ ...f, type: e.target.value as CalendarEvent['type'] }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.entries(CALENDAR_EVENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
            <textarea
              value={holidayForm.description}
              onChange={e => setHolidayForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={holidayForm.is_recurring}
              onChange={e => setHolidayForm(f => ({ ...f, is_recurring: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Se repite todos los años (misma fecha)
          </label>
        </div>
      </Modal>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Main calendar area ~70% */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={prevPeriod} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
                <span className="text-base font-semibold text-gray-800 min-w-[180px] text-center">{periodLabel}</span>
                <button onClick={nextPeriod} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              </div>
              <button
                onClick={goToday}
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Hoy
              </button>
            </div>

          {view === 'mes' && (
            <MonthView
              year={year}
              month={month}
              actByDate={actByDate}
              allActByDate={allActByDate}
              eventByDate={eventByDate}
              decisionsByDate={decisionsByDate}
              todayStr={todayStr}
              selectedDay={selectedDay}
              onSelectDay={handleSelectDay}
              showAll={showAll}
            />
          )}

          {view === 'semana' && (
            <WeekView
              weekStart={weekStart}
              actByDate={actByDate}
              allActByDate={allActByDate}
              eventByDate={eventByDate}
              decisionsByDate={decisionsByDate}
              todayStr={todayStr}
              onSelectDay={(key) => handleSelectDay(key)}
              showAll={showAll}
            />
          )}

          {view === 'dia' && (
            <DayView
              date={dayDate}
              actByDate={actByDate}
              allActByDate={allActByDate}
              eventByDate={eventByDate}
              decisionsByDate={decisionsByDate}
              onNavigate={(id) => navigate(id)}
              onView={handleView}
              onEdit={handleEdit}
              showAll={showAll}
              todayStr={todayStr}
            />
          )}

          {/* Día seleccionado (vista Mes) */}
          {view === 'mes' && selectedDay && (
            <div className="mt-4">
              <SelectedDayPanel
                selectedDay={selectedDay}
                actByDate={actByDate}
                allActByDate={allActByDate}
                eventByDate={eventByDate}
                decisionsByDate={decisionsByDate}
                onNavigate={(id) => navigate(id)}
                onView={handleView}
                onEdit={handleEdit}
                onClose={() => setSelectedDay(null)}
                showAll={showAll}
                todayStr={todayStr}
              />
            </div>
          )}
        </div>

        {/* Panel lateral ~30%, fijo (sticky) */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <SidePanel
              activities={activities}
              today={today}
              onNavigate={(id) => navigate(id)}
              onEdit={handleEdit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
