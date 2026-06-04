'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { WorkspaceActivity, CalendarEvent, DateStatus } from '@/lib/types';
import { MOCK_WORKSPACE, MOCK_CALENDAR_EVENTS } from '@/lib/mock-data';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function dateStatusColor(ds: DateStatus): string {
  if (ds === 'overdue') return 'bg-red-100 text-red-800';
  if (ds === 'approaching') return 'bg-amber-100 text-amber-800';
  if (ds === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (ds === 'on_time') return 'bg-green-100 text-green-700';
  return 'bg-gray-100 text-gray-500';
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface DayActivities {
  activities: WorkspaceActivity[];
  events: CalendarEvent[];
}

export default function CalendarioPage() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [view] = useState<'month'>('month');
  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<WorkspaceActivity[]>(ENDPOINTS.CALENDAR_MY_DELIVERABLES)
      .then(setActivities)
      .catch(() => setActivities(MOCK_WORKSPACE.activities));

    api
      .get<CalendarEvent[]>(`${ENDPOINTS.CALENDAR_EVENTS}?year=${currentYear}`)
      .then(setCalEvents)
      .catch(() => setCalEvents(MOCK_CALENDAR_EVENTS));
  }, [currentYear]);

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const cells: Array<Date | null> = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) {
      cells.push(null);
    } else {
      cells.push(new Date(currentYear, currentMonth, dayNum));
    }
  }

  // Index activities by date
  const actByDate: Record<string, WorkspaceActivity[]> = {};
  activities.forEach((act) => {
    if (act.commitment_date) {
      const key = act.commitment_date.slice(0, 10);
      actByDate[key] = actByDate[key] ? [...actByDate[key], act] : [act];
    }
  });

  const eventByDate: Record<string, CalendarEvent[]> = {};
  calEvents.forEach((ev) => {
    const key = ev.date.slice(0, 10);
    eventByDate[key] = eventByDate[key] ? [...eventByDate[key], ev] : [ev];
  });

  const selectedData: DayActivities | null = selectedDay
    ? { activities: actByDate[selectedDay] ?? [], events: eventByDate[selectedDay] ?? [] }
    : null;

  const todayStr = toYMD(today);

  return (
    <div className="p-6 flex gap-6">
      {/* Calendar main */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <span className="text-base font-semibold text-gray-800 min-w-[160px] text-center">
              {MONTHS[currentMonth]} {currentYear}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {wd}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((date, idx) => {
              const key = date ? toYMD(date) : `empty-${idx}`;
              const dayActs = date ? (actByDate[key] ?? []) : [];
              const dayEvts = date ? (eventByDate[key] ?? []) : [];
              const isToday = date ? key === todayStr : false;
              const isHoliday = dayEvts.length > 0;
              const isSelected = key === selectedDay;

              return (
                <div
                  key={key}
                  onClick={() => date && setSelectedDay(isSelected ? null : key)}
                  className={clsx(
                    'min-h-[90px] border-b border-r border-gray-100 p-1.5 last:border-r-0 transition-colors',
                    date ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50/50',
                    isToday && 'bg-indigo-50',
                    isSelected && 'ring-2 ring-inset ring-indigo-400',
                    isHoliday && !isToday && 'bg-gray-50'
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

                      {isHoliday && (
                        <div className="text-[10px] text-gray-500 bg-gray-200 rounded px-1 mb-0.5 truncate">
                          {dayEvts[0].name}
                        </div>
                      )}

                      {dayActs.slice(0, 3).map((act) => (
                        <div
                          key={act.id}
                          className={clsx(
                            'text-[10px] rounded px-1 mb-0.5 truncate',
                            dateStatusColor(act.date_status)
                          )}
                          title={act.deliverable.name}
                        >
                          {act.deliverable.name}
                        </div>
                      ))}

                      {dayActs.length > 3 && (
                        <div className="text-[10px] text-gray-400 px-1">
                          +{dayActs.length - 3} más
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4">
          <span className="text-xs text-gray-500 font-medium">Leyenda:</span>
          {[
            { color: 'bg-green-100 text-green-700', label: 'A tiempo' },
            { color: 'bg-amber-100 text-amber-800', label: 'Por vencer' },
            { color: 'bg-red-100 text-red-800', label: 'Vencido' },
            { color: 'bg-emerald-100 text-emerald-800', label: 'Completado' },
            { color: 'bg-gray-200 text-gray-500', label: 'Festivo' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={clsx('w-3 h-3 rounded-sm', color)} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      {selectedDay && selectedData && (
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 sticky top-6">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-CO', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </h3>
            </div>

            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {selectedData.events.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Eventos</p>
                  {selectedData.events.map((ev) => (
                    <div key={ev.id} className="text-sm bg-gray-100 rounded-lg px-3 py-2">
                      <p className="font-medium text-gray-800">{ev.name}</p>
                      {ev.description && <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              {selectedData.activities.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mis actividades</p>
                  {selectedData.activities.map((act) => (
                    <div key={act.id} className="border border-gray-100 rounded-lg p-3 mb-2">
                      <p className="text-sm font-medium text-gray-900">{act.deliverable.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{act.subject.name}</p>
                      <p className="text-xs text-gray-400">{act.project.name}</p>
                      <div className={clsx('inline-flex items-center gap-1 mt-1.5 rounded-full px-2 py-0.5 text-xs font-medium', dateStatusColor(act.date_status))}>
                        {act.date_status === 'overdue' ? 'Vencido' :
                          act.date_status === 'approaching' ? 'Por vencer' :
                          act.date_status === 'completed' ? 'Completado' :
                          act.date_status === 'on_time' ? 'A tiempo' : 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedData.activities.length === 0 && selectedData.events.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin actividades para este día.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
