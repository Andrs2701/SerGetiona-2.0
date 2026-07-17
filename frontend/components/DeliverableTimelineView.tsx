'use client';

import { useState, useEffect } from 'react';
import { api, ENDPOINTS } from '@/lib/api';
import type { TimelineEvent } from '@/lib/types';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

const TIMELINE_COLORS: Record<string, string> = {
  created: 'bg-indigo-500', assigned: 'bg-sky-500', status: 'bg-blue-500',
  delivered: 'bg-teal-500', date_changed: 'bg-amber-400', note: 'bg-gray-400', approved: 'bg-emerald-500',
};

const ROLE_DOT_COLORS: Record<string, string> = {
  expert: 'bg-purple-400', pedagogy: 'bg-pink-400', design: 'bg-blue-400',
  audiovisual: 'bg-orange-400', engineering: 'bg-cyan-400', qa: 'bg-emerald-400',
};

/**
 * Línea de tiempo de un entregable completo (los 6 roles en una sola lista
 * cronológica). Si se pasa `activityRole`, se ocultan los eventos de
 * creación/asignación de los DEMÁS roles (vista de un responsable viendo su
 * propio entregable); sin `activityRole` no se filtra nada — es la vista
 * consolidada que usa el admin/coordinador.
 */
export default function DeliverableTimelineView({ deliverableId, activityRole }: { deliverableId: number; activityRole?: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<{ events: TimelineEvent[] }>(ENDPOINTS.DELIVERABLE_TIMELINE(deliverableId))
      .then((r) => setEvents(r.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [deliverableId]);

  if (loading) return <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700/40 rounded animate-pulse" />)}</div>;
  if (!events.length) return <p className="text-sm text-gray-400 py-4 text-center">Sin eventos registrados</p>;

  const filtered = activityRole
    ? events.filter(ev => (ev.type !== 'created' && ev.type !== 'assigned') || ev.role === activityRole)
    : events;

  return (
    <div className="relative pl-5 space-y-4">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-100 dark:bg-gray-700" />
      {filtered.map((ev, i) => {
        const dotColor = ev.role ? (ROLE_DOT_COLORS[ev.role] ?? 'bg-gray-400') : (TIMELINE_COLORS[ev.type] ?? 'bg-gray-400');
        return (
          <div key={i} className="relative flex gap-3">
            <div className={`absolute -left-3 w-2 h-2 rounded-full mt-1.5 ${dotColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{ev.label}</p>
                {!activityRole && ev.role_label && (
                  <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{ev.role_label}</span>
                )}
              </div>
              <div className="flex gap-2 mt-0.5 text-[10px] text-gray-400">
                {ev.user && <span>{ev.user}</span>}
                {ev.date && <span>{formatDateTime(ev.date)}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
