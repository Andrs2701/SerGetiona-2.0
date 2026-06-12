'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, CheckCircle2, TrendingUp, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Workspace } from '@/lib/types';

interface SidebarItem {
  id: number;
  title: string;
  subtitle: string;
  date: string | null;
  dateStatus: string;
  status: string;
}

interface AllActivity {
  id: number;
  deliverable_name?: string | null;
  role_label?: string | null;
  responsible_name?: string | null;
  commitment_date?: string | null;
  actual_delivery_date?: string | null;
  status: string;
  date_status?: string;
}

const DONE_STATUSES = ['approved', 'not_applicable'];

function daysLeftLabel(date: string): { label: string; cls: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(date + 'T00:00:00').getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `Vencida hace ${Math.abs(diff)}d`, cls: 'text-red-600 font-semibold' };
  if (diff === 0) return { label: 'Vence hoy', cls: 'text-amber-600 font-semibold' };
  if (diff <= 5) return { label: `En ${diff}d`, cls: 'text-amber-600' };
  return { label: `En ${diff}d`, cls: 'text-gray-400' };
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7; // lunes = 0
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

export default function RightSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuthContext();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';

  const [items, setItems] = useState<SidebarItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      if (isManager) {
        // El endpoint devuelve un array plano de actividades
        const res = await api.get<AllActivity[] | { activities: AllActivity[] }>(ENDPOINTS.CALENDAR_ALL_ACTIVITIES);
        const list = Array.isArray(res) ? res : res.activities ?? [];
        setItems(
          list.map((a) => ({
            id: a.id,
            title: a.deliverable_name ?? '—',
            subtitle: [a.role_label, a.responsible_name].filter(Boolean).join(' · '),
            date: a.commitment_date ?? null,
            dateStatus: a.date_status ?? 'on_time',
            status: a.status,
          }))
        );
      } else {
        const ws = await api.get<Workspace>(ENDPOINTS.MY_WORKSPACE);
        setItems(
          (ws.activities ?? []).map((a) => ({
            id: a.id,
            title: a.deliverable?.name ?? '—',
            subtitle: [a.program?.name, a.subject?.name].filter(Boolean).join(' · '),
            date: a.commitment_date ?? null,
            dateStatus: a.date_status,
            status: a.status,
          }))
        );
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, isManager]);

  useEffect(() => {
    if (!open) return;
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load, open]);

  if (!open) return null;

  const active = items.filter((i) => !DONE_STATUSES.includes(i.status));

  // Top 5 próximos vencimientos (con fecha, no vencidas)
  const upcoming = active
    .filter((i) => i.date && i.dateStatus !== 'overdue')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 5);

  // Críticas: vencidas
  const critical = active
    .filter((i) => i.dateStatus === 'overdue')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 5);

  // Resumen semanal
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const inWeek = items.filter((i) => {
    if (!i.date) return false;
    const d = new Date(i.date + 'T00:00:00');
    return d >= weekStart && d < weekEnd;
  });
  const weekDone = inWeek.filter((i) => DONE_STATUSES.includes(i.status) || i.status === 'delivered').length;
  const weekPct = inWeek.length > 0 ? Math.round((weekDone / inWeek.length) * 100) : 0;

  const detailHref = isManager ? '/seguimiento' : '/mi-espacio';

  return (
    <aside className="hidden xl:flex w-72 flex-none flex-col border-l border-gray-200 bg-white overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <CalendarClock size={15} className="text-indigo-500" />
          {isManager ? 'Panorama del equipo' : 'Mi día'}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-gray-500 transition-colors"
          title="Ocultar panel"
        >
          <X size={15} />
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {/* Resumen semanal */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <TrendingUp size={12} />
              Resumen semanal
            </h4>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Programadas</span>
                <strong>{inWeek.length}</strong>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Entregadas</span>
                <strong className="text-emerald-600">{weekDone}</strong>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Cumplimiento</span>
                  <span className="font-semibold text-gray-700">{weekPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      weekPct >= 70 ? 'bg-emerald-500' : weekPct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                    )}
                    style={{ width: `${weekPct}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Críticas */}
          {critical.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle size={12} />
                Críticas / vencidas
              </h4>
              <div className="space-y-1.5">
                {critical.map((i) => (
                  <Link
                    key={i.id}
                    href={detailHref}
                    className="block bg-red-50/60 border border-red-100 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-800 truncate">{i.title}</p>
                    <p className="text-[10px] text-gray-500 truncate">{i.subtitle}</p>
                    {i.date && (
                      <p className={clsx('text-[10px] mt-0.5', daysLeftLabel(i.date).cls)}>
                        {daysLeftLabel(i.date).label}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Próximos vencimientos */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <CalendarClock size={12} />
              Próximos vencimientos
            </h4>
            {upcoming.length === 0 ? (
              <p className="text-xs text-gray-400 flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-3">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Sin entregas próximas. ¡Al día!
              </p>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map((i) => (
                  <Link
                    key={i.id}
                    href={detailHref}
                    className="block border border-gray-100 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-800 truncate">{i.title}</p>
                    <p className="text-[10px] text-gray-500 truncate">{i.subtitle}</p>
                    {i.date && (
                      <p className={clsx('text-[10px] mt-0.5', daysLeftLabel(i.date).cls)}>
                        {daysLeftLabel(i.date).label} · {new Date(i.date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
