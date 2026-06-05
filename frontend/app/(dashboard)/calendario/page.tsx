'use client';

import { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, ExternalLink, Send } from 'lucide-react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { api, ENDPOINTS } from '@/lib/api';
import type { WorkspaceActivity, CalendarEvent } from '@/lib/types';
import { ROLE_STATUS_LABELS } from '@/lib/types';
import { MOCK_WORKSPACE, MOCK_CALENDAR_EVENTS } from '@/lib/mock-data';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Chip dot color by date_status / status
function chipDotColor(act: WorkspaceActivity): string {
  if (act.status === 'approved') return 'bg-emerald-500';
  if (act.date_status === 'overdue') return 'bg-red-500';
  if (act.date_status === 'approaching') return 'bg-amber-400';
  if (act.status === 'in_progress' || act.status === 'in_review' || act.status === 'delivered') return 'bg-blue-500';
  return 'bg-gray-400';
}

function chipBg(act: WorkspaceActivity): string {
  if (act.status === 'approved') return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
  if (act.date_status === 'overdue') return 'bg-red-50 text-red-800 border border-red-200';
  if (act.date_status === 'approaching') return 'bg-amber-50 text-amber-800 border border-amber-200';
  if (act.status === 'in_progress' || act.status === 'in_review') return 'bg-blue-50 text-blue-800 border border-blue-200';
  return 'bg-gray-50 text-gray-700 border border-gray-200';
}

function statusBadgeClass(act: WorkspaceActivity): string {
  if (act.status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (act.date_status === 'overdue') return 'bg-red-100 text-red-700';
  if (act.date_status === 'approaching') return 'bg-amber-100 text-amber-700';
  if (['in_progress', 'in_review', 'delivered'].includes(act.status)) return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-600';
}

function statusLabel(act: WorkspaceActivity): string {
  if (act.status === 'approved') return 'Completada';
  if (act.date_status === 'overdue') return 'Vencida';
  if (act.date_status === 'approaching') return 'Por vencer';
  return ROLE_STATUS_LABELS[act.status] ?? act.status;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function CalendarioPage() {
  const router = useRouter();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Toggle: "mis actividades" vs "todas"  (only visible for admin/coordinator)
  const [showAll, setShowAll] = useState(false);
  const { user } = useAuthContext();
  const canToggle = user?.role === 'admin' || user?.role === 'coordinator';

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
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startOffset = firstDay.getDay();
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const cells: Array<Date | null> = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    cells.push(dayNum < 1 || dayNum > lastDay.getDate() ? null : new Date(currentYear, currentMonth, dayNum));
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

  const todayStr = toYMD(today);

  const selectedActs = selectedDay ? (actByDate[selectedDay] ?? []) : [];
  const selectedEvts = selectedDay ? (eventByDate[selectedDay] ?? []) : [];

  return (
    <div className="p-6 flex gap-6">
      {/* Calendar main */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
            {/* Toggle mis/todas */}
            {canToggle && (
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-sm">
                <button
                  onClick={() => setShowAll(false)}
                  className={clsx(
                    'px-3 py-1 rounded-md font-medium transition-colors',
                    !showAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  Mis actividades
                </button>
                <button
                  onClick={() => setShowAll(true)}
                  className={clsx(
                    'px-3 py-1 rounded-md font-medium transition-colors',
                    showAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  Todas
                </button>
              </div>
            )}
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
              const overflow = dayActs.length > 2 ? dayActs.length - 2 : 0;
              const visibleActs = dayActs.slice(0, 2);

              return (
                <div
                  key={key}
                  onClick={() => date && setSelectedDay(isSelected ? null : key)}
                  className={clsx(
                    'min-h-[90px] border-b border-r border-gray-100 p-1.5 last:border-r-0 transition-colors',
                    date ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50/50',
                    isToday && 'bg-indigo-50',
                    isSelected && 'ring-2 ring-inset ring-indigo-400',
                    isHoliday && !isToday && 'bg-rose-50/40'
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
                        <div className="text-[10px] text-rose-600 bg-rose-100 rounded px-1 mb-0.5 truncate">
                          {dayEvts[0].name}
                        </div>
                      )}

                      {visibleActs.map((act) => (
                        <div
                          key={act.id}
                          className={clsx('flex items-center gap-1 text-[10px] rounded px-1 mb-0.5 truncate', chipBg(act))}
                          title={act.deliverable.name}
                        >
                          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', chipDotColor(act))} />
                          <span className="truncate">
                            {act.deliverable.name.length > 15
                              ? act.deliverable.name.slice(0, 15) + '…'
                              : act.deliverable.name}
                          </span>
                        </div>
                      ))}

                      {overflow > 0 && (
                        <div className="text-[10px] text-indigo-500 font-medium px-1">
                          +{overflow} más
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
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Leyenda:</span>
          {[
            { dot: 'bg-emerald-500', label: 'Completada' },
            { dot: 'bg-blue-500', label: 'Programada' },
            { dot: 'bg-amber-400', label: 'Por vencer' },
            { dot: 'bg-red-500', label: 'Vencida' },
          ].map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={clsx('w-2.5 h-2.5 rounded-full', dot)} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      {selectedDay && (
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 sticky top-6">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-CO', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </h3>
            </div>

            <div className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
              {selectedEvts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Eventos</p>
                  {selectedEvts.map((ev) => (
                    <div key={ev.id} className="text-sm bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-1">
                      <p className="font-medium text-rose-800">{ev.name}</p>
                      {ev.description && <p className="text-xs text-rose-500 mt-0.5">{ev.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              {selectedActs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actividades</p>
                  {selectedActs.map((act) => (
                    <div key={act.id} className="border border-gray-100 rounded-lg p-3 mb-2 space-y-1.5">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{act.deliverable.name}</p>
                      <p className="text-xs text-gray-500">{act.program.name}</p>
                      <p className="text-xs text-gray-400">{act.subject.name}</p>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusBadgeClass(act))}>
                          {statusLabel(act)}
                        </span>
                      </div>

                      {/* Buttons */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          onClick={() => router.push(`/proyectos/${act.project.id}`)}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <ExternalLink size={11} /> Ver
                        </button>
                        {['not_started', 'in_progress', 'in_development', 'draft', 'pending'].includes(act.status) && (
                          <button
                            onClick={() => {/* quick deliver — no toast needed in calendar */}}
                            className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium ml-2"
                          >
                            <Send size={11} /> Entregar rápido
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedActs.length === 0 && selectedEvts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin actividades para este día.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
