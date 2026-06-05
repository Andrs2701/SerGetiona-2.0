'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar, Clock,
  XCircle, CheckCircle2, AlertTriangle, ExternalLink,
  LayoutGrid, AlignJustify,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { WorkspaceActivity, CalendarEvent } from '@/lib/types';
import { ROLE_STATUS_LABELS } from '@/lib/types';
import { MOCK_WORKSPACE, MOCK_CALENDAR_EVENTS } from '@/lib/mock-data';
import { useAuthContext } from '@/contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type ViewMode = 'mes' | 'semana' | 'dia' | 'agenda';

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

// ─── Activity card ────────────────────────────────────────────────────────────
function ActivityCard({ act, onNavigate }: { act: WorkspaceActivity; onNavigate: (id: number) => void }) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-1.5 hover:border-gray-200 transition-colors">
      <p className="text-sm font-semibold text-gray-900 leading-snug">{act.deliverable.name}</p>
      <p className="text-xs text-gray-500">{act.program.name}</p>
      <p className="text-xs text-gray-400">{act.subject.name}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', activityStatusBadgeClass(act))}>
          {activityStatusLabel(act)}
        </span>
        {act.commitment_date && (
          <span className="text-xs text-gray-400">
            {new Date(act.commitment_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      <button
        onClick={() => onNavigate(act.project.id)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium pt-0.5"
      >
        <ExternalLink size={11} /> Ver proyecto
      </button>
    </div>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────
function SidePanel({
  activities,
  today,
  onNavigate,
}: {
  activities: WorkspaceActivity[];
  today: Date;
  onNavigate: (id: number) => void;
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
    const scheduled = activities.filter(
      (a) => a.commitment_date && a.commitment_date >= wsStr && a.commitment_date <= weStr
    );
    const done = scheduled.filter((a) => a.status === 'approved');
    return { weekScheduled: scheduled.length, weekDone: done.length };
  }, [activities, today]);

  const weekCompliance = weekScheduled > 0 ? Math.round((weekDone / weekScheduled) * 100) : 0;

  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-4">
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
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => onNavigate(act.project.id)}
              >
                <span className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', activityDotClass(act))} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{act.deliverable.name}</p>
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
                className="p-2 rounded-lg bg-red-50 cursor-pointer"
                onClick={() => onNavigate(act.project.id)}
              >
                <p className="text-xs font-medium text-red-800 truncate">{act.deliverable.name}</p>
                <p className="text-xs text-red-500">{act.subject.name}</p>
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
              <span className="text-gray-600">Cumplimiento</span>
              <span className={clsx(
                'font-bold',
                weekCompliance >= 80 ? 'text-emerald-600' : weekCompliance >= 50 ? 'text-amber-600' : 'text-red-600'
              )}>
                {weekCompliance}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-2 rounded-full transition-all',
                  weekCompliance >= 80 ? 'bg-emerald-500' : weekCompliance >= 50 ? 'bg-amber-400' : 'bg-red-400'
                )}
                style={{ width: `${weekCompliance}%` }}
              />
            </div>
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
            { cls: 'bg-amber-400', label: 'Festivo' },
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
  eventByDate,
  todayStr,
  selectedDay,
  onSelectDay,
}: {
  year: number;
  month: number;
  actByDate: Record<string, WorkspaceActivity[]>;
  eventByDate: Record<string, CalendarEvent[]>;
  todayStr: string;
  selectedDay: string | null;
  onSelectDay: (d: string | null) => void;
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
          const dayActs = date ? (actByDate[key] ?? []) : [];
          const dayEvts = date ? (eventByDate[key] ?? []) : [];
          const isToday = date ? key === todayStr : false;
          const isSelected = key === selectedDay;
          const visibleActs = dayActs.slice(0, 2);
          const overflow = dayActs.length > 2 ? dayActs.length - 2 : 0;

          return (
            <div
              key={key}
              onClick={() => date && onSelectDay(isSelected ? null : key)}
              className={clsx(
                'min-h-[90px] border-b border-r border-gray-100 p-1.5 transition-colors',
                date ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50/50',
                isToday && 'bg-indigo-50',
                isSelected && 'ring-2 ring-inset ring-indigo-400',
                dayEvts.length > 0 && !isToday && !isSelected && 'bg-amber-50/30'
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
                    <div key={ev.id} className="text-[10px] bg-amber-100 text-amber-700 rounded px-1 mb-0.5 truncate">
                      {ev.name}
                    </div>
                  ))}
                  {visibleActs.map((act) => (
                    <div
                      key={act.id}
                      className={clsx('text-[10px] rounded px-1 mb-0.5 truncate', activityChipClass(act))}
                      title={act.deliverable.name}
                    >
                      {act.deliverable.name.length > 14
                        ? act.deliverable.name.slice(0, 14) + '…'
                        : act.deliverable.name}
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
  eventByDate,
  todayStr,
  onSelectDay,
}: {
  weekStart: Date;
  actByDate: Record<string, WorkspaceActivity[]>;
  eventByDate: Record<string, CalendarEvent[]>;
  todayStr: string;
  onSelectDay: (d: string) => void;
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
          const dayActs = actByDate[key] ?? [];
          const dayEvts = eventByDate[key] ?? [];
          const isToday = key === todayStr;

          return (
            <div
              key={key}
              className={clsx(
                'border-r border-gray-100 last:border-r-0 p-2 min-h-[400px] cursor-pointer hover:bg-gray-50/50 transition-colors',
                isToday && 'bg-indigo-50/30'
              )}
              onClick={() => onSelectDay(key)}
            >
              {dayEvts.map((ev) => (
                <div key={ev.id} className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 mb-1 truncate">
                  {ev.name}
                </div>
              ))}
              {dayActs.map((act) => (
                <div
                  key={act.id}
                  className={clsx('text-[10px] rounded px-1.5 py-0.5 mb-1 truncate', activityChipClass(act))}
                  title={act.deliverable.name}
                >
                  {act.deliverable.name.length > 16
                    ? act.deliverable.name.slice(0, 16) + '…'
                    : act.deliverable.name}
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
  eventByDate,
  onNavigate,
}: {
  date: Date;
  actByDate: Record<string, WorkspaceActivity[]>;
  eventByDate: Record<string, CalendarEvent[]>;
  onNavigate: (id: number) => void;
}) {
  const key = toYMD(date);
  const dayActs = actByDate[key] ?? [];
  const dayEvts = eventByDate[key] ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{getDayLabel(date)}</h2>
      </div>
      <div className="p-6">
        {dayEvts.length === 0 && dayActs.length === 0 && (
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
        {dayActs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Actividades ({dayActs.length})
            </p>
            <div className="space-y-3">
              {dayActs.map((act) => (
                <ActivityCard key={act.id} act={act} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AGENDA VIEW ──────────────────────────────────────────────────────────────
function AgendaView({
  activities,
  calEvents,
  today,
  onNavigate,
}: {
  activities: WorkspaceActivity[];
  calEvents: CalendarEvent[];
  today: Date;
  onNavigate: (id: number) => void;
}) {
  const todayStr = toYMD(today);

  type AgendaItem =
    | { kind: 'activity'; date: string; act: WorkspaceActivity }
    | { kind: 'event'; date: string; ev: CalendarEvent };

  const grouped = useMemo(() => {
    const items: AgendaItem[] = [
      ...activities
        .filter((a) => a.commitment_date && a.commitment_date >= todayStr)
        .map((a): AgendaItem => ({ kind: 'activity', date: a.commitment_date!, act: a })),
      ...calEvents
        .filter((e) => e.date >= todayStr)
        .map((e): AgendaItem => ({ kind: 'event', date: e.date, ev: e })),
    ].sort((a, b) => (a.date > b.date ? 1 : -1));

    const map: Record<string, AgendaItem[]> = {};
    for (const item of items) {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    }
    return map;
  }, [activities, calEvents, todayStr]);

  const dates = Object.keys(grouped).sort().slice(0, 60);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {dates.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">Sin eventos próximos.</p>
      )}
      <div className="divide-y divide-gray-100">
        {dates.map((dateStr) => {
          const d = new Date(dateStr + 'T12:00:00');
          const isToday = dateStr === todayStr;
          return (
            <div key={dateStr} className="flex">
              <div className={clsx(
                'w-32 flex-shrink-0 px-4 py-4 text-right border-r border-gray-100',
                isToday && 'bg-indigo-50'
              )}>
                <p className="text-xs text-gray-500 uppercase">{WEEKDAYS_LONG[d.getDay()].slice(0, 3)}</p>
                <p className={clsx('text-2xl font-bold leading-none mt-0.5', isToday ? 'text-indigo-600' : 'text-gray-800')}>
                  {d.getDate()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{MONTHS[d.getMonth()].slice(0, 3)}</p>
              </div>
              <div className="flex-1 px-4 py-3 space-y-2">
                {grouped[dateStr].map((item, i) => {
                  if (item.kind === 'event') {
                    return (
                      <div key={`ev-${item.ev.id}-${i}`} className="flex items-center gap-2 py-1">
                        <span className="w-2 h-2 rounded-sm bg-amber-400 flex-shrink-0" />
                        <span className="text-sm text-amber-700 font-medium">{item.ev.name}</span>
                        <span className="text-xs text-amber-500 capitalize">{item.ev.type}</span>
                      </div>
                    );
                  }
                  const act = item.act;
                  return (
                    <div
                      key={`act-${act.id}-${i}`}
                      className={clsx('flex items-start gap-2 py-1.5 px-2 rounded-lg cursor-pointer hover:opacity-80', activityChipClass(act))}
                      onClick={() => onNavigate(act.project.id)}
                    >
                      <span className={clsx('w-2 h-2 rounded-full mt-1 flex-shrink-0', activityDotClass(act))} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{act.deliverable.name}</p>
                        <p className="text-xs opacity-75 truncate">{act.subject.name} · {act.program.name}</p>
                      </div>
                      <span className="text-xs font-medium opacity-75 flex-shrink-0">{activityStatusLabel(act)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Selected day detail (inline below month grid) ────────────────────────────
function SelectedDayPanel({
  selectedDay,
  actByDate,
  eventByDate,
  onNavigate,
  onClose,
}: {
  selectedDay: string;
  actByDate: Record<string, WorkspaceActivity[]>;
  eventByDate: Record<string, CalendarEvent[]>;
  onNavigate: (id: number) => void;
  onClose: () => void;
}) {
  const dayActs = actByDate[selectedDay] ?? [];
  const dayEvts = eventByDate[selectedDay] ?? [];
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
        {dayActs.map((act) => (
          <ActivityCard key={act.id} act={act} onNavigate={onNavigate} />
        ))}
        {dayActs.length === 0 && dayEvts.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Sin actividades.</p>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CalendarioPage() {
  // Navigation is handled inline; activity detail opens via /mi-espacio
  const navigate = (id: number) => { void id; /* TODO: open detail */ };
  const { user: _user } = useAuthContext();
  const today = useMemo(() => new Date(), []);
  const todayStr = toYMD(today);

  const [view, setView] = useState<ViewMode>('mes');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(today));
  const [dayDate, setDayDate] = useState<Date>(() => new Date(today));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    api
      .get<WorkspaceActivity[]>(ENDPOINTS.CALENDAR_MY_DELIVERABLES)
      .then(setActivities)
      .catch(() => setActivities(MOCK_WORKSPACE.activities));
  }, []);

  useEffect(() => {
    api
      .get<CalendarEvent[]>(`${ENDPOINTS.CALENDAR_EVENTS}?year=${year}`)
      .then(setCalEvents)
      .catch(() => setCalEvents(MOCK_CALENDAR_EVENTS));
  }, [year]);

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

  const eventByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of calEvents) {
      const key = ev.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [calEvents]);

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
    return 'Agenda';
  }, [view, month, year, weekStart, dayDate]);

  const showNav = view !== 'agenda';

  const viewTabs: Array<{ id: ViewMode; icon: React.ReactNode; label: string }> = [
    { id: 'mes', icon: <Calendar size={14} />, label: 'Mes' },
    { id: 'semana', icon: <LayoutGrid size={14} />, label: 'Semana' },
    { id: 'dia', icon: <Clock size={14} />, label: 'Día' },
    { id: 'agenda', icon: <AlignJustify size={14} />, label: 'Agenda' },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
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
      </div>

      <div className="flex gap-6 items-start">
        {/* Main calendar area ~70% */}
        <div className="flex-1 min-w-0">
          {showNav && (
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
          )}

          {view === 'agenda' && (
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-800">Próximos eventos y entregas</h2>
            </div>
          )}

          {view === 'mes' && (
            <MonthView
              year={year}
              month={month}
              actByDate={actByDate}
              eventByDate={eventByDate}
              todayStr={todayStr}
              selectedDay={selectedDay}
              onSelectDay={handleSelectDay}
            />
          )}

          {view === 'semana' && (
            <WeekView
              weekStart={weekStart}
              actByDate={actByDate}
              eventByDate={eventByDate}
              todayStr={todayStr}
              onSelectDay={(key) => handleSelectDay(key)}
            />
          )}

          {view === 'dia' && (
            <DayView
              date={dayDate}
              actByDate={actByDate}
              eventByDate={eventByDate}
              onNavigate={(id) => navigate(id)}
            />
          )}

          {view === 'agenda' && (
            <AgendaView
              activities={activities}
              calEvents={calEvents}
              today={today}
              onNavigate={(id) => navigate(id)}
            />
          )}

          {/* Día seleccionado (vista Mes) */}
          {view === 'mes' && selectedDay && (
            <div className="mt-4">
              <SelectedDayPanel
                selectedDay={selectedDay}
                actByDate={actByDate}
                eventByDate={eventByDate}
                onNavigate={(id) => navigate(id)}
                onClose={() => setSelectedDay(null)}
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
