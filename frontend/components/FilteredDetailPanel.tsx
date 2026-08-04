import React from 'react';
import { X, CheckCircle2, Users, BookOpen, CalendarDays, XCircle, AlertTriangle, Clock, Eye, Pencil } from 'lucide-react';
import clsx from 'clsx';

export interface PanelRow {
  id: string | number;
  name: string;
  responsible?: string;
  program?: string;
  subject?: string;
  commitment_date?: string;
  days_diff?: number;
  status?: string;
  role?: string;
  /** Cuando está presente, la fila muestra "Ver entrega"/"Editar entrega". */
  deliverable_id?: number;
}

interface FilteredDetailPanelProps {
  isOpen: boolean;
  title: string;
  rows: PanelRow[];
  loading: boolean;
  onClose: () => void;
  onView?: (deliverableId: number) => void;
  onEdit?: (deliverableId: number) => void;
}

export function formatDateStr(date?: string): string {
  if (!date) return '—';
  return new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function FilteredDetailPanel({ isOpen, title, rows, loading, onClose, onView, onEdit }: FilteredDetailPanelProps) {
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />}
      <div className={clsx(
        "fixed right-0 top-0 h-full w-full sm:w-[480px] max-w-[100vw] bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Detalle filtrado</p>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-400 flex-shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl h-20 animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2 py-20">
              <CheckCircle2 size={36} className="text-emerald-300" />
              <p>Sin registros para este filtro</p>
            </div>
          ) : rows.map((row) => {
            const isOverdue = (row.days_diff ?? 0) < 0;
            const isApproach = !isOverdue && (row.days_diff ?? 99) <= 5;
            const borderCls = isOverdue 
              ? 'border-l-4 border-l-red-500' 
              : isApproach 
                ? 'border-l-4 border-l-amber-400' 
                : 'border-l-4 border-l-blue-100 dark:border-l-blue-900';
            return (
              <div key={row.id} className={clsx("bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 p-4", borderCls)}>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">{row.name}</p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {row.responsible && (
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      <span className="truncate">{row.responsible}</span>
                    </span>
                  )}
                  {row.program && (
                    <span className="flex items-center gap-1 truncate">
                      <BookOpen size={10} />
                      <span className="truncate">{row.program}</span>
                    </span>
                  )}
                  {row.commitment_date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays size={10} />
                      {formatDateStr(row.commitment_date)}
                    </span>
                  )}
                </div>
                {row.days_diff !== undefined && (
                  <div className="mt-2">
                    {isOverdue ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-full px-2 py-0.5">
                        <XCircle size={10} /> Vencida hace {Math.abs(row.days_diff)} día(s)
                      </span>
                    ) : row.days_diff === 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5">
                        <AlertTriangle size={10} /> Vence hoy
                      </span>
                    ) : isApproach ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5">
                        <AlertTriangle size={10} /> Vence en {row.days_diff} día(s)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 dark:bg-gray-700 rounded-full px-2 py-0.5">
                        <Clock size={10} /> {row.days_diff} días restantes
                      </span>
                    )}
                  </div>
                )}
                {row.deliverable_id !== undefined && (onView || onEdit) && (
                  <div className="flex items-center gap-3 flex-wrap mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700">
                    {onView && (
                      <button
                        onClick={() => onView(row.deliverable_id!)}
                        className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-semibold hover:underline"
                      >
                        <Eye size={11} /> Ver entrega
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(row.deliverable_id!)}
                        className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold hover:underline"
                      >
                        <Pencil size={11} /> Editar entrega
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <p className="text-xs text-gray-400 text-center">{rows.length} registros encontrados</p>
        </div>
      </div>
    </>
  );
}
