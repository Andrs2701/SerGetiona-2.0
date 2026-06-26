'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Eye, MessageCircle, FileText, CheckCircle2, Send, RotateCcw,
  X, Download, ChevronDown, AlertCircle, Clock, Filter,
  Upload, Plus, Pencil, Trash2, User as UserIcon, Calendar,
  BookOpen, FolderOpen, LayoutList, Table2, ExternalLink,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { api, ENDPOINTS, downloadCsv } from '@/lib/api';
import type { Deliverable, RoleActivity, Comment, Role, User, DeliverableFlow } from '@/lib/types';
import {
  GLOBAL_STATUS_LABELS, DELIVERABLE_TYPE_LABELS, ROLE_LABELS,
} from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { clsx } from 'clsx';
import { useAuthContext } from '@/contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: Role[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

const ROLE_ABBR: Record<Role, string> = {
  expert: 'EXP', pedagogy: 'PED', design: 'DIS',
  audiovisual: 'AUD', engineering: 'ING', qa: 'QA',
};

const ROLE_BADGE_BG: Record<Role, string> = {
  expert: 'bg-violet-500', pedagogy: 'bg-blue-500', design: 'bg-pink-500',
  audiovisual: 'bg-amber-500', engineering: 'bg-teal-500', qa: 'bg-emerald-600',
};

const ROLE_CELL_COLORS: Record<Role, { bg: string; border: string; label: string }> = {
  expert:      { bg: 'bg-violet-50',  border: 'border-violet-100',  label: 'text-violet-700' },
  pedagogy:    { bg: 'bg-blue-50',    border: 'border-blue-100',    label: 'text-blue-700' },
  design:      { bg: 'bg-pink-50',    border: 'border-pink-100',    label: 'text-pink-700' },
  audiovisual: { bg: 'bg-amber-50',   border: 'border-amber-100',   label: 'text-amber-700' },
  engineering: { bg: 'bg-teal-50',    border: 'border-teal-100',    label: 'text-teal-700' },
  qa:          { bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'text-emerald-700' },
};

const ACTIVITY_STATUS_CFG: Record<string, { label: string; dot: string; text: string }> = {
  not_started:       { label: 'Sin iniciar',   dot: 'bg-gray-300',    text: 'text-gray-500' },
  in_progress:       { label: 'En progreso',   dot: 'bg-blue-500',    text: 'text-blue-700' },
  delivered:         { label: 'Entregado',     dot: 'bg-indigo-500',  text: 'text-indigo-700' },
  in_review:         { label: 'En revisión',   dot: 'bg-purple-500',  text: 'text-purple-700' },
  with_observations: { label: 'Observaciones', dot: 'bg-orange-500',  text: 'text-orange-700' },
  approved:          { label: 'Aprobado',      dot: 'bg-emerald-500', text: 'text-emerald-700' },
  not_applicable:    { label: 'No aplica',     dot: 'bg-gray-200',    text: 'text-gray-400' },
};

type QuickAction = 'approve' | 'deliver' | 'request_adjustments';
type ViewMode = 'rows' | 'grouped';

// ─── Utilities ────────────────────────────────────────────────────────────────

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

const ROLE_DONE_STATUSES = ['delivered', 'in_review', 'with_observations', 'approved'] as const;

function calcProgressExcNA(activities: RoleActivity[]): { pct: number; done: number; total: number } {
  const relevant = activities.filter(a => a.status !== 'not_applicable');
  if (relevant.length === 0) return { pct: 0, done: 0, total: 0 };
  const done = relevant.filter(a => (ROLE_DONE_STATUSES as readonly string[]).includes(a.status)).length;
  return { pct: Math.round((done / relevant.length) * 100), done, total: relevant.length };
}

function getActiveActivity(d: Deliverable): RoleActivity | undefined {
  const acts = d.role_activities ?? [];
  return (
    acts.find(a => a.status !== 'approved' && a.status !== 'not_applicable' && a.status !== 'not_started') ??
    acts.find(a => a.status === 'not_started')
  );
}

// Finds the activity that is actually ready to be delivered (actively in development)
function getDeliverableActivity(d: Deliverable): RoleActivity | undefined {
  return (d.role_activities ?? []).find(a => a.status === 'in_development');
}

function isOverdue(d: Deliverable): boolean {
  if (d.global_status === 'finished' || d.global_status === 'cancelled') return false;
  return (d.role_activities ?? []).some(a => {
    if (a.status === 'not_applicable' || a.status === 'approved') return false;
    const days = daysUntil(a.commitment_date);
    return days !== null && days < 0;
  });
}

function isApproaching(d: Deliverable): boolean {
  if (d.global_status === 'finished' || d.global_status === 'cancelled') return false;
  return (d.role_activities ?? []).some(a => {
    if (a.status === 'not_applicable' || a.status === 'approved') return false;
    const days = daysUntil(a.commitment_date);
    return days !== null && days >= 0 && days <= 5;
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastMsg { id: number; message: string; type: 'success' | 'error'; }

function Toast({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={clsx(
          'px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2',
          t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        )}>
          {t.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Activity status indicator ─────────────────────────────────────────────────

function ActivityStatusBadge({ status }: { status: string }) {
  const cfg = ACTIVITY_STATUS_CFG[status] ?? ACTIVITY_STATUS_CFG.not_started;
  return (
    <span className="flex items-center gap-1 min-w-0">
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      <span className={clsx('text-[10px] font-semibold leading-tight', cfg.text)}>{cfg.label}</span>
    </span>
  );
}

// ─── Progress bar (excluding N/A) ─────────────────────────────────────────────

function ProgressExcNA({ activities, compact }: { activities: RoleActivity[]; compact?: boolean }) {
  const { pct, done, total } = calcProgressExcNA(activities);
  if (total === 0) return <span className="text-[10px] text-gray-300">—</span>;
  return (
    <div className={clsx('flex items-center gap-2', compact ? 'min-w-[80px]' : 'min-w-[130px]')}>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all',
            pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-orange-400' : 'bg-gray-300'
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-bold text-gray-700 whitespace-nowrap">
        {done}/{total} <span className="font-normal text-gray-400">({pct}%)</span>
      </span>
    </div>
  );
}

// ─── Role cell ─────────────────────────────────────────────────────────────────

function RoleCell({ role, activity }: { role: Role; activity?: RoleActivity }) {
  const isNA = !activity || activity.status === 'not_applicable';
  const colors = ROLE_CELL_COLORS[role];
  const days = daysUntil(activity?.commitment_date);
  const overdueDate = !isNA && activity?.status !== 'approved' && days !== null && days < 0;

  return (
    <div className={clsx(
      'rounded-xl border p-3 flex flex-col gap-1.5',
      isNA ? 'bg-gray-50 border-gray-100 opacity-40' : clsx(colors.bg, colors.border)
    )}>
      {/* Role label */}
      <div className="flex items-center gap-1.5">
        <span className={clsx('text-[9px] font-black px-1.5 py-0.5 rounded text-white tracking-wider shrink-0', ROLE_BADGE_BG[role])}>
          {ROLE_ABBR[role]}
        </span>
        <span className={clsx('text-[10px] font-bold leading-tight', isNA ? 'text-gray-400' : colors.label)}>
          {ROLE_LABELS[role]}
        </span>
      </div>

      {isNA ? (
        <p className="text-[10px] text-gray-300 italic">No aplica</p>
      ) : (
        <>
          {/* Responsible */}
          <div className="flex items-center gap-1">
            <UserIcon size={9} className="text-gray-400 shrink-0" />
            <span className="text-[11px] font-semibold text-gray-800 truncate leading-tight">
              {activity?.responsible?.name ?? <span className="text-gray-300 font-normal italic">Sin asignar</span>}
            </span>
          </div>

          {/* Status */}
          <ActivityStatusBadge status={activity?.status ?? 'not_started'} />

          {/* Date */}
          <div className="flex items-center gap-1">
            <Calendar size={9} className={clsx('shrink-0', overdueDate ? 'text-red-400' : 'text-gray-300')} />
            <span className={clsx('text-[10px] leading-tight font-medium',
              overdueDate        ? 'text-red-500' :
              activity?.status === 'approved' ? 'text-emerald-600' :
              'text-gray-500'
            )}>
              {formatDate(activity?.commitment_date)}
              {overdueDate && (
                <span className="ml-0.5 text-[9px] font-bold text-red-500">({Math.abs(days!)}d)</span>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Deliverable Row (primary "rows" view) ────────────────────────────────────

interface RowProps {
  deliverable: Deliverable;
  isManager: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onQuickAction: (a: QuickAction) => void;
}

function DeliverableRow({ deliverable: d, isManager, onView, onEdit, onDelete, onQuickAction }: RowProps) {
  const acts = d.role_activities ?? [];
  const byRole: Partial<Record<Role, RoleActivity>> = {};
  acts.forEach(a => { byRole[a.role] = a; });

  const overdue = isOverdue(d);
  const { pct, done, total } = calcProgressExcNA(acts);
  const isFinished = d.global_status === 'finished';

  const canApprove = d.global_status === 'in_review' || d.global_status === 'with_observations';
  const canDeliver = !!getDeliverableActivity(d);
  const canAdjust  = d.global_status === 'in_review';

  return (
    <div className={clsx(
      'px-5 py-4 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors relative',
      overdue && !isFinished
        ? 'border-l-4 border-l-red-500 hover:bg-red-50/40 dark:hover:bg-red-900/10'
        : 'hover:bg-slate-50/60 dark:hover:bg-gray-800/40'
    )}>
      {/* ── Header line ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Subject + module */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900 leading-tight">{d.subject_name ?? '—'}</h3>
            <span className={clsx(
              'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide',
              d.type === 'creation' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
            )}>{DELIVERABLE_TYPE_LABELS[d.type]}</span>
            {overdue && !isFinished && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded uppercase">
                <AlertCircle size={8} /> Vencida
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 leading-tight">{d.name}</p>
        </div>

        {/* Status badge */}
        <StatusBadge status={d.global_status} type="global" />

        {/* Progress (N/A excluded) */}
        {total > 0 && (
          <div className="flex items-center gap-2 min-w-[140px]">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all',
                  pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-orange-400' : 'bg-gray-300'
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-700 whitespace-nowrap">
              {done}/{total} <span className="font-normal text-gray-400">({pct}%)</span>
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          {canApprove && (
            <button title="Aprobar" onClick={() => onQuickAction('approve')}
              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors">
              <CheckCircle2 size={14} />
            </button>
          )}
          {canDeliver && (
            <button title="Entregar" onClick={() => onQuickAction('deliver')}
              className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-colors">
              <Send size={14} />
            </button>
          )}
          {canAdjust && (
            <button title="Solicitar ajustes" onClick={() => onQuickAction('request_adjustments')}
              className="p-1.5 rounded-md text-orange-500 hover:bg-orange-50 transition-colors">
              <RotateCcw size={14} />
            </button>
          )}
          <span className="w-px h-4 bg-gray-200 mx-0.5" />
          <button title="Ver detalle" onClick={onView}
            className="p-1.5 rounded-md text-gray-400 hover:text-[#194276] hover:bg-blue-50 transition-colors">
            <Eye size={14} />
          </button>
          {isManager && (
            <>
              <button title="Editar" onClick={onEdit}
                className="p-1.5 rounded-md text-gray-400 hover:text-[#194276] hover:bg-blue-50 transition-colors">
                <Pencil size={14} />
              </button>
              <button title="Eliminar" onClick={onDelete}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Role grid: 2 cols mobile · 3 cols sm · 6 cols lg ─────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:grid-cols-6">
        {ROLES.map(role => (
          <RoleCell key={role} role={role} activity={byRole[role]} />
        ))}
      </div>

      {pct === 100 && total > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
          <CheckCircle2 size={11} /> Todos los roles completados
        </div>
      )}
    </div>
  );
}

// ─── Group header (shared between views) ──────────────────────────────────────

function GroupHeaderLegacy({
  programName, projectName, items, groupKey, isCollapsed, onToggle,
}: {
  programName: string; projectName: string; items: Deliverable[];
  groupKey: string; isCollapsed: boolean; onToggle: () => void;
}) {
  const overdueCount = items.filter(isOverdue).length;
  const totalRelevant = items.reduce((s, d) => s + calcProgressExcNA(d.role_activities ?? []).total, 0);
  const totalDone     = items.reduce((s, d) => s + calcProgressExcNA(d.role_activities ?? []).done,  0);
  const avg = totalRelevant > 0 ? Math.round((totalDone / totalRelevant) * 100) : 0;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
    >
      <ChevronDown size={15} className={clsx('text-gray-400 transition-transform shrink-0 duration-200', isCollapsed && '-rotate-90')} />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="font-bold text-gray-900 text-sm">{programName}</span>
        <span className="text-gray-300">·</span>
        <span className="text-xs text-gray-500 truncate">{projectName}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-gray-400">{items.length} módulo{items.length !== 1 ? 's' : ''}</span>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
            <AlertCircle size={10} /> {overdueCount}
          </span>
        )}
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full',
          avg >= 70 ? 'bg-emerald-100 text-emerald-700' : avg >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        )}>{avg}%</span>
      </div>
    </button>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function GroupHeader({
  programName, projectName, items, groupKey, isCollapsed, onToggle,
}: {
  programName: string; projectName: string; items: Deliverable[];
  groupKey: string; isCollapsed: boolean; onToggle: () => void;
}) {
  const overdueCount = items.filter(isOverdue).length;
  const approachingCount = items.filter(isApproaching).length;
  const activeCount = items.filter(d => !['finished', 'cancelled'].includes(d.global_status)).length;
  const totalRelevant = items.reduce((s, d) => s + calcProgressExcNA(d.role_activities ?? []).total, 0);
  const totalDone = items.reduce((s, d) => s + calcProgressExcNA(d.role_activities ?? []).done, 0);
  const avg = totalRelevant > 0 ? Math.round((totalDone / totalRelevant) * 100) : 0;
  const risk = overdueCount > 0 ? 'critical' : approachingCount > 0 || avg < 50 ? 'warning' : 'healthy';
  const riskLabel = risk === 'critical' ? 'Crítico' : risk === 'warning' ? 'Atención' : 'Al día';
  const statusLabel = avg >= 100 ? 'Finalizado' : avg > 0 ? 'En progreso' : 'Pendiente';

  return (
    <button
      onClick={onToggle}
      className="w-full flex flex-col gap-3 px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
      title={groupKey}
    >
      <div className="flex w-full items-start gap-3">
        <ChevronDown size={16} className={clsx('mt-1 text-gray-400 transition-transform shrink-0 duration-200', isCollapsed && '-rotate-90')} />
        <span className={clsx('mt-1.5 h-2.5 w-2.5 rounded-full shrink-0',
          risk === 'critical' ? 'bg-red-500' : risk === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'
        )} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-900 text-sm break-words">{programName}</span>
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full',
              risk === 'critical' ? 'bg-red-100 text-red-700' : risk === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            )}>{riskLabel}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{statusLabel}</span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{projectName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={clsx('text-lg font-black leading-none',
            avg >= 70 ? 'text-emerald-600' : avg >= 40 ? 'text-amber-600' : 'text-red-600'
          )}>{avg}%</p>
          <p className="text-[10px] text-gray-400 mt-0.5">avance</p>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5">
        <span className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">Total <strong className="text-gray-800">{items.length}</strong></span>
        <span className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">Vencidos <strong>{overdueCount}</strong></span>
        <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Próx. vencer <strong>{approachingCount}</strong></span>
        <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">Activos <strong>{activeCount}</strong></span>
        <span className={clsx('rounded-lg px-3 py-2 text-xs font-semibold',
          risk === 'critical' ? 'bg-red-100 text-red-700' : risk === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
        )}>Riesgo {riskLabel}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={clsx('h-full rounded-full',
            avg >= 70 ? 'bg-emerald-500' : avg >= 40 ? 'bg-amber-400' : 'bg-red-500'
          )}
          style={{ width: `${avg}%` }}
        />
      </div>
    </button>
  );
}

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onCancel} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={20} className="text-red-600" />
          </div>
          <h3 className="text-center font-semibold text-gray-900 mb-2">Eliminar entregable</h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            ¿Seguro que deseas eliminar <strong>"{name}"</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
            <button onClick={onConfirm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Eliminar</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Deliverable Form Panel ───────────────────────────────────────────────────

interface ActivityForm { role: Role; responsible_id: string; commitment_date: string; }

interface DeliverableFormData {
  project_id: string; program_name: string; subject_name: string;
  name: string; type: 'creation' | 'update'; start_date: string;
  activities: ActivityForm[];
}

const EMPTY_FORM: DeliverableFormData = {
  project_id: '', program_name: '', subject_name: '',
  name: '', type: 'creation', start_date: '',
  activities: ROLES.map(r => ({ role: r, responsible_id: '', commitment_date: '' })),
};

interface DeliverableFormPanelProps {
  mode: 'create' | 'edit'; deliverable?: Deliverable;
  projects: Array<{ id: number; name: string }>; users: User[]; programs: string[];
  onClose: () => void; onSave: (updated?: Deliverable) => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}

function DeliverableFormPanel({ mode, deliverable, projects, users, programs, onClose, onSave, addToast }: DeliverableFormPanelProps) {
  const [form, setForm] = useState<DeliverableFormData>(() => {
    if (mode === 'edit' && deliverable) {
      return {
        project_id: String(deliverable.project_id ?? ''),
        program_name: deliverable.program_name ?? '',
        subject_name: deliverable.subject_name ?? '',
        name: deliverable.name,
        type: deliverable.type,
        start_date: deliverable.start_date ?? '',
        activities: ROLES.map(r => {
          const act = (deliverable.role_activities ?? []).find(a => a.role === r);
          return { role: r, responsible_id: act?.responsible ? String(act.responsible.id) : '', commitment_date: act?.commitment_date ?? '' };
        }),
      };
    }
    return { ...EMPTY_FORM };
  });
  const [saving, setSaving] = useState(false);

  function setAct(role: Role, field: keyof ActivityForm, value: string) {
    setForm(prev => ({ ...prev, activities: prev.activities.map(a => a.role === role ? { ...a, [field]: value } : a) }));
  }

  async function handleSave() {
    if (!form.name.trim()) { addToast('El nombre del entregable es obligatorio.', 'error'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(), type: form.type,
        start_date: form.start_date || null,
        program_name: form.program_name.trim() || null,
        subject_name: form.subject_name.trim() || null,
        activities: form.activities.filter(a => a.responsible_id || a.commitment_date).map(a => ({
          role: a.role,
          responsible_id: a.responsible_id ? Number(a.responsible_id) : null,
          commitment_date: a.commitment_date || null,
        })),
      };
      if (mode === 'create') payload.project_id = form.project_id ? Number(form.project_id) : null;
      if (mode === 'create') {
        await api.post<Deliverable>(ENDPOINTS.DELIVERABLES, payload);
        addToast('Entregable creado correctamente.', 'success');
        onSave();
      } else {
        const updated = await api.put<Deliverable>(ENDPOINTS.DELIVERABLE(deliverable!.id), payload);
        addToast('Entregable actualizado correctamente.', 'success');
        onSave(updated);
      }
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Error al guardar.', 'error');
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[540px] max-w-full bg-white dark:bg-gray-800 z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              {mode === 'create' ? <Plus size={16} style={{ color: '#194276' }} /> : <Pencil size={16} style={{ color: '#194276' }} />}
              {mode === 'create' ? 'Agregar entregable' : 'Editar entregable'}
            </h2>
            {mode === 'edit' && deliverable && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{deliverable.subject_name} / {deliverable.name}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {/* Location */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <FolderOpen size={12} /> Ubicación
            </p>
            {mode === 'create' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Proyecto <span className="text-red-500">*</span></label>
                <select value={form.project_id} onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30">
                  <option value="">Selecciona un proyecto...</option>
                  {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Programa</label>
                <input list="programs-list" value={form.program_name}
                  onChange={e => setForm(p => ({ ...p, program_name: e.target.value }))}
                  placeholder="Ej: Ingeniería de Sistemas"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30" />
                <datalist id="programs-list">{programs.map(p => <option key={p} value={p} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Asignatura</label>
                <input value={form.subject_name} onChange={e => setForm(p => ({ ...p, subject_name: e.target.value }))}
                  placeholder="Ej: Diseño de Interfaces"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30" />
              </div>
            </div>
          </div>

          {/* Deliverable info */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <BookOpen size={12} /> Entregable
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre / Módulo <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Semana 1 – Introducción"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as 'creation' | 'update' }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30">
                  <option value="creation">Creación</option>
                  <option value="update">Actualización</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de inicio</label>
                <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30" />
              </div>
            </div>
          </div>

          {/* Role activities */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <UserIcon size={12} /> Responsables y fechas por rol
            </p>
            <div className="space-y-2">
              {form.activities.map(act => {
                const colors = ROLE_CELL_COLORS[act.role];
                return (
                  <div key={act.role} className={clsx('rounded-xl border p-3 space-y-2', colors.bg, colors.border)}>
                    <div className="flex items-center gap-1.5">
                      <span className={clsx('text-[9px] font-black px-1.5 py-0.5 rounded text-white', ROLE_BADGE_BG[act.role])}>
                        {ROLE_ABBR[act.role]}
                      </span>
                      <p className={clsx('text-xs font-semibold', colors.label)}>{ROLE_LABELS[act.role]}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select value={act.responsible_id} onChange={e => setAct(act.role, 'responsible_id', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-white/70 bg-white/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/20">
                        <option value="">Sin asignar</option>
                        {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                      </select>
                      <input type="date" value={act.commitment_date} onChange={e => setAct(act.role, 'commitment_date', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-white/70 bg-white/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/20" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="w-full sm:w-auto px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: '#194276' }}>
            {saving
              ? <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</span>
              : mode === 'create' ? 'Crear entregable' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

type PanelTab = 'info' | 'flow' | 'evidencias';

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide shrink-0 w-28">{label}</span>
      <span className="text-xs text-gray-700 dark:text-gray-300 min-w-0 truncate">{value ?? '—'}</span>
    </div>
  );
}

function SidePanel({ deliverable, defaultTab = 'info', onClose }: { deliverable: Deliverable; defaultTab?: PanelTab; onClose: () => void }) {
  const [tab, setTab] = useState<PanelTab>(defaultTab);
  const [flow, setFlow] = useState<DeliverableFlow | null>(null);
  const [loadingFlow, setLoadingFlow] = useState(false);

  useEffect(() => { setTab(defaultTab); }, [defaultTab, deliverable.id]);
  useEffect(() => {
    if (tab !== 'evidencias') return;
    setLoadingFlow(true);
    api.get<DeliverableFlow>(ENDPOINTS.DELIVERABLE_FLOW(deliverable.id))
      .then(setFlow).catch(() => setFlow(null)).finally(() => setLoadingFlow(false));
  }, [tab, deliverable.id]);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[520px] max-w-full bg-white dark:bg-gray-800 z-50 shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">{deliverable.project_name ?? '—'} · {deliverable.program_name ?? '—'}</p>
            <h2 className="font-bold text-gray-900 text-sm">{deliverable.subject_name ?? '—'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{deliverable.name}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="flex border-b border-gray-100 px-4 sm:px-5 overflow-x-auto">
          {(['info', 'flow', 'evidencias'] as PanelTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={clsx(
              'py-2.5 px-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === t ? 'border-[#194276] text-[#194276]' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
              {t === 'info' ? 'Info' : t === 'flow' ? 'Flujo' : 'Evidencias'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === 'info' && (() => {
            const applicableActs = (deliverable.role_activities ?? []).filter(a => a.status !== 'not_applicable');
            const endDate = applicableActs
              .map(a => a.commitment_date)
              .filter(Boolean)
              .sort()
              .at(-1);
            return (
            <div className="space-y-4">
              {/* Identificación */}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2.5 space-y-1.5">
                <InfoField label="Programa" value={deliverable.program_name} />
                <InfoField label="Asignatura" value={deliverable.subject_name} />
                <InfoField label="Módulo / Semana" value={deliverable.name} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-400 uppercase mb-1">Estado</p><StatusBadge status={deliverable.global_status} type="global" /></div>
                <div><p className="text-xs text-gray-400 uppercase mb-1">Tipo</p>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                    deliverable.type === 'creation' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                  )}>{DELIVERABLE_TYPE_LABELS[deliverable.type]}</span>
                </div>
                <div><p className="text-xs text-gray-400 uppercase mb-1">Avance (excl. N/A)</p>
                  <ProgressExcNA activities={deliverable.role_activities ?? []} compact />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <div><p className="text-xs text-gray-400 uppercase mb-1">Inicio</p>
                    <span className="text-sm text-gray-700">{formatDate(deliverable.start_date) ?? '—'}</span>
                  </div>
                  <div><p className="text-xs text-gray-400 uppercase mb-1">Fin estimado</p>
                    <span className="text-sm text-gray-700">{formatDate(endDate) ?? '—'}</span>
                  </div>
                </div>
              </div>
              {deliverable.notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-700">{deliverable.notes}</p>
                </div>
              )}
              {/* Fechas por Rol */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fechas por Rol</p>
                <div className="rounded-lg border border-gray-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400">
                        <th className="text-left px-3 py-2 font-medium">Rol</th>
                        <th className="text-left px-3 py-2 font-medium">Programada</th>
                        <th className="text-left px-3 py-2 font-medium">Real</th>
                        <th className="text-left px-3 py-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {ROLES.map(role => {
                        const act = (deliverable.role_activities ?? []).find(a => a.role === role);
                        const isNA = act?.status === 'not_applicable';
                        const cfg = ACTIVITY_STATUS_CFG[act?.status ?? 'not_started'];
                        return (
                          <tr key={role} className={clsx('transition-colors', isNA ? 'opacity-50' : '')}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className={clsx('text-[9px] font-black px-1 py-0.5 rounded text-white', ROLE_BADGE_BG[role])}>{ROLE_ABBR[role]}</span>
                                <span className="text-gray-700 font-medium">{ROLE_LABELS[role]}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {isNA ? <span className="text-gray-400 italic">No aplica</span> : formatDateShort(act?.commitment_date)}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {isNA ? '—' : formatDateShort(act?.actual_delivery_date)}
                            </td>
                            <td className="px-3 py-2">
                              <span className={clsx('font-medium', cfg?.text ?? 'text-gray-500')}>
                                {cfg?.label ?? '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            );
          })()}
          {tab === 'flow' && (
            <div className="space-y-2">
              {ROLES.map(role => {
                const act = (deliverable.role_activities ?? []).find(a => a.role === role);
                const isNA = act?.status === 'not_applicable';
                const daysLeft = daysUntil(act?.commitment_date);
                const isDelivered = act?.status === 'delivered' || act?.status === 'approved';
                const isOverdue = !isDelivered && daysLeft !== null && daysLeft < 0;
                const isApproaching = !isDelivered && daysLeft !== null && daysLeft >= 0 && daysLeft <= 5;

                // Days difference between commitment and actual delivery
                let deliveryDiffLabel: string | null = null;
                if (isDelivered && act?.actual_delivery_date && act?.commitment_date) {
                  const diff = Math.round(
                    (new Date(act.actual_delivery_date + 'T00:00:00').getTime() - new Date(act.commitment_date + 'T00:00:00').getTime()) / 86400000
                  );
                  deliveryDiffLabel = diff <= 0
                    ? `Entregado ${diff === 0 ? 'a tiempo' : `${Math.abs(diff)}d antes`}`
                    : `Entregado ${diff}d tarde`;
                }

                // Visual delivery indicator badge
                const deliveryBadge = (() => {
                  if (isNA) return null;
                  if (isDelivered && deliveryDiffLabel) {
                    const onTime = act?.actual_delivery_date && act?.commitment_date && act.actual_delivery_date <= act.commitment_date;
                    return (
                      <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded',
                        onTime ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      )}>{deliveryDiffLabel}</span>
                    );
                  }
                  if (isOverdue) return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">Vencido</span>;
                  if (isApproaching) return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Próximo a vencer</span>;
                  return null;
                })();

                return (
                  <div key={role} className={clsx('rounded-lg border p-3',
                    isNA ? 'border-gray-100 bg-gray-50 opacity-50' :
                    act?.status === 'approved' ? 'border-emerald-100 bg-emerald-50' :
                    isOverdue ? 'border-red-100 bg-red-50' :
                    isApproaching ? 'border-amber-100 bg-amber-50' :
                    !act || act.status === 'not_started' ? 'border-gray-100 bg-gray-50' :
                    'border-blue-100 bg-blue-50'
                  )}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('text-[9px] font-black px-1 py-0.5 rounded text-white', ROLE_BADGE_BG[role])}>{ROLE_ABBR[role]}</span>
                        <span className="text-xs font-semibold text-gray-700">{ROLE_LABELS[role]}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {deliveryBadge}
                        <ActivityStatusBadge status={act?.status ?? 'not_started'} />
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span>{act?.responsible?.name ?? '—'}</span>
                        {!isNA && act?.commitment_date && (
                          <span className={clsx(isOverdue ? 'text-red-500 font-semibold' : isApproaching ? 'text-amber-600 font-medium' : '')}>
                            Prog: {formatDateShort(act.commitment_date)}
                          </span>
                        )}
                      </div>
                      {!isNA && act?.actual_delivery_date && (
                        <div className="flex justify-end">
                          <span className="text-gray-400">Real: {formatDateShort(act.actual_delivery_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'evidencias' && (
            loadingFlow
              ? <div className="text-center py-10 text-gray-400 text-sm">Cargando evidencias…</div>
              : !flow
                ? <div className="text-center py-10 text-gray-400 text-sm">Sin datos de producción</div>
                : <div className="space-y-5">
                    {/* Recursos entregados por rol */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recursos entregados por rol</p>
                      <div className="space-y-2">
                        {flow.roles.map(r => {
                          const totalProd = r.production.reduce((s, p) => s + p.total, 0);
                          if (r.status === 'not_applicable') return null;
                          return (
                            <div key={r.role} className={clsx(
                              'rounded-lg border p-3',
                              ROLE_CELL_COLORS[r.role as Role]?.bg ?? 'bg-gray-50',
                              ROLE_CELL_COLORS[r.role as Role]?.border ?? 'border-gray-100',
                            )}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className={clsx('text-[9px] font-black px-1 py-0.5 rounded text-white', ROLE_BADGE_BG[r.role as Role] ?? 'bg-gray-400')}>
                                    {ROLE_ABBR[r.role as Role] ?? r.role.toUpperCase()}
                                  </span>
                                  <span className={clsx('text-xs font-semibold', ROLE_CELL_COLORS[r.role as Role]?.label ?? 'text-gray-700')}>
                                    {ROLE_LABELS[r.role as Role] ?? r.role}
                                  </span>
                                </div>
                                <ActivityStatusBadge status={r.status} />
                              </div>
                              {r.production.length === 0 ? (
                                <p className="text-[10px] text-gray-400 italic">Sin producción registrada</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {r.production.map(p => (
                                    <span key={p.resource_type} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/70 rounded text-[10px] font-medium text-gray-700 border border-white/50">
                                      <span className="font-bold">{p.total}</span> {p.resource_type}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {r.notes && (
                                <p className="text-[10px] text-gray-500 mt-1.5 italic leading-relaxed">{r.notes}</p>
                              )}
                              {r.responsible && (
                                <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
                                  <UserIcon size={9} /> {r.responsible.name}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Enlaces de evidencia */}
                    {flow.roles.some(r => r.links.length > 0) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Evidencias y enlaces</p>
                        <div className="space-y-1.5">
                          {flow.roles.flatMap(r => r.links.map(lk => ({ ...lk, role: r.role }))).map(lk => (
                            <div key={lk.id} className="flex items-start gap-2.5 bg-gray-50 rounded-lg px-3 py-2">
                              <ExternalLink size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={clsx('text-[9px] font-black px-1 py-0.5 rounded text-white', ROLE_BADGE_BG[lk.role as Role] ?? 'bg-gray-400')}>
                                    {ROLE_ABBR[lk.role as Role] ?? lk.role.toUpperCase()}
                                  </span>
                                  {lk.url ? (
                                    <a href={lk.url} target="_blank" rel="noopener noreferrer"
                                      className="text-xs font-medium text-indigo-600 hover:underline truncate max-w-[220px]">
                                      {lk.title}
                                    </a>
                                  ) : (
                                    <span className="text-xs font-medium text-gray-700 truncate">{lk.title}</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {lk.user?.name ?? '—'} · {new Date(lk.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────────────────────

interface ImportError { row: number; field: string; message: string; }
interface ImportResult { imported?: number; valid?: number; invalid?: number; errors?: ImportError[]; preview?: Array<Record<string, string>>; project_id?: number; }

function BulkImportModal({ projects, onClose, onSuccess, addToast }: {
  projects: Array<{ id: number; name: string }>;
  onClose: () => void; onSuccess: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const [projectMode, setProjectMode] = useState<'existing' | 'new'>('existing');
  const [projectId, setProjectId]     = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [resolvedProjectId, setResolvedProjectId] = useState('');
  const [file, setFile]     = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ImportResult | null>(null);
  const [errors, setErrors]   = useState<ImportError[]>([]);
  const [step, setStep]       = useState<'upload' | 'preview' | 'done'>('upload');
  const [dlTemplate, setDlTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function buildForm() {
    const form = new FormData();
    form.append('file', file!);
    if (resolvedProjectId) form.append('project_id', resolvedProjectId);
    else if (projectMode === 'existing' && projectId) form.append('project_id', projectId);
    else if (projectMode === 'new' && newProjectName.trim()) form.append('project_name', newProjectName.trim());
    return form;
  }

  async function handleDlTemplate() {
    setDlTemplate(true);
    try { await downloadCsv(ENDPOINTS.IMPORT_TEMPLATE, 'plantilla_sergestiona.xlsx'); }
    catch { addToast('Error al descargar la plantilla.', 'error'); }
    finally { setDlTemplate(false); }
  }

  async function handleValidate() {
    setLoading(true); setErrors([]); setResult(null);
    try {
      const res = await api.postForm<ImportResult>(`${ENDPOINTS.IMPORT_DELIVERABLES}?validate_only=1`, buildForm());
      setResult(res); setErrors(res.errors ?? []);
      if (res.project_id) setResolvedProjectId(String(res.project_id));
      setStep('preview');
    } catch (e: unknown) { setErrors([{ row: 0, field: 'file', message: e instanceof Error ? e.message : 'Error al procesar.' }]); }
    finally { setLoading(false); }
  }

  async function handleImport() {
    setLoading(true);
    try {
      const res = await api.postForm<ImportResult>(ENDPOINTS.IMPORT_DELIVERABLES, buildForm());
      setResult(res); setErrors(res.errors ?? []); setStep('done');
      if ((res.imported ?? 0) > 0) { addToast(`${res.imported} entregable(s) importados.`, 'success'); onSuccess(); }
    } catch (e: unknown) { setErrors([{ row: 0, field: 'file', message: e instanceof Error ? e.message : 'Error.' }]); }
    finally { setLoading(false); }
  }

  const isReady = !!file && (projectMode === 'existing' ? !!projectId : newProjectName.trim().length > 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2"><Upload size={16} className="text-blue-600 dark:text-blue-400" /> Carga Masiva</h2>
              <p className="text-xs text-gray-500 dark:text-slate-300 mt-0.5">Importa entregables desde un archivo Excel (.xlsx)</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-300"><X size={18} /></button>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-0 px-6 pt-4 pb-2">
            {(['upload', 'preview', 'done'] as const).map((s, i) => {
              const labels = ['Cargar', 'Validar', 'Resultado'];
              const done = (step === 'preview' && i === 0) || step === 'done';
              const active = step === s;
              return (
                <div key={s} className="flex items-center gap-0">
                  <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
                    done ? 'bg-emerald-500 text-white ring-emerald-200 dark:ring-emerald-800' : active ? 'bg-blue-700 text-white ring-blue-200 dark:ring-blue-700' : 'bg-gray-100 text-gray-400 ring-transparent dark:bg-slate-800 dark:text-slate-400'
                  )}>
                    {done ? <CheckCircle2 size={12} /> : i + 1}
                  </div>
                  <span className={clsx('text-xs ml-2', active ? 'font-semibold text-gray-900 dark:text-slate-100' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500')}>{labels[i]}</span>
                  {i < 2 && <div className="w-8 h-px bg-gray-200 dark:bg-slate-600 mx-2" />}
                </div>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {step === 'upload' && (
              <>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3 shadow-sm dark:border-blue-500/40 dark:bg-blue-950/45">
                  <FileText size={16} className="text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Descarga la plantilla Excel</p>
                    <p className="text-xs text-blue-700 mt-0.5 mb-2">Complétala y súbela. Responsables por correo institucional.</p>
                    <button onClick={handleDlTemplate} disabled={dlTemplate}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 underline underline-offset-2 disabled:opacity-60 dark:text-blue-200 dark:hover:text-white">
                      <Download size={12} /> {dlTemplate ? 'Descargando...' : 'Descargar plantilla (.xlsx)'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Proyecto de destino <span className="text-red-500">*</span></label>
                  <div className="flex gap-2 mb-2">
                    {(['existing', 'new'] as const).map(m => (
                      <button key={m} type="button" onClick={() => setProjectMode(m)}
                        className={clsx('flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors',
                          projectMode === m ? 'text-white border-blue-700 bg-blue-700 shadow-sm' : 'text-gray-500 border-gray-200 hover:bg-gray-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-800'
                        )}>
                        {m === 'existing' ? 'Proyecto existente' : 'Crear nuevo proyecto'}
                      </button>
                    ))}
                  </div>
                  {projectMode === 'existing'
                    ? <select value={projectId} onChange={e => setProjectId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                        <option value="">Selecciona un proyecto...</option>
                        {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                      </select>
                    : <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                        placeholder="Nombre del nuevo proyecto"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
                  }
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5">Archivo Excel <span className="text-red-500">*</span></label>
                  <div className={clsx('border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                    file ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/35' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-blue-400 dark:hover:bg-blue-950/30'
                  )} onClick={() => fileInputRef.current?.click()}>
                    <Upload size={26} className={clsx('mx-auto mb-2', file ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400 dark:text-slate-300')} />
                    {file
                      ? <div><p className="text-sm font-semibold text-gray-800">{file.name}</p><p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p></div>
                      : <><p className="text-sm text-gray-600">Haz clic para seleccionar</p><p className="text-xs text-gray-400 mt-1">Formato: .xlsx — Máx. 10 MB</p></>
                    }
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  </div>
                </div>
                {errors.length > 0 && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                    {errors.map((err, i) => <p key={i} className="text-xs text-red-700">{err.message}</p>)}
                  </div>
                )}
              </>
            )}
            {step === 'preview' && result && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-600">{result.valid ?? 0}</p>
                    <p className="text-xs text-emerald-700 mt-1">Filas válidas</p>
                  </div>
                  <div className={clsx('rounded-xl border p-4 text-center', (result.invalid ?? 0) > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100')}>
                    <p className={clsx('text-3xl font-bold', (result.invalid ?? 0) > 0 ? 'text-red-600' : 'text-gray-300')}>{result.invalid ?? 0}</p>
                    <p className={clsx('text-xs mt-1', (result.invalid ?? 0) > 0 ? 'text-red-700' : 'text-gray-400')}>Filas con errores</p>
                  </div>
                </div>
                {errors.length > 0 && (
                  <div className="max-h-44 overflow-y-auto space-y-1.5">
                    {errors.map((err, i) => (
                      <div key={i} className="flex gap-2.5 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <span className="font-mono font-semibold text-red-400 whitespace-nowrap">Fila {err.row}</span>
                        <span className="font-mono text-red-400">[{err.field}]</span>
                        <span className="text-red-700">{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {step === 'done' && result && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Importación completada</h3>
                <p className="text-sm text-gray-600"><span className="font-bold text-emerald-600">{result.imported}</span> entregable(s) importados.</p>
                {errors.length > 0 && <p className="text-xs text-red-600 mt-2">{errors.length} fila(s) omitidas.</p>}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            {step !== 'done'
              ? <button onClick={step === 'upload' ? onClose : () => { setStep('upload'); setResult(null); setErrors([]); setResolvedProjectId(''); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  {step === 'upload' ? 'Cancelar' : 'Volver'}
                </button>
              : <div />}
            <div className="flex gap-2">
              {step === 'upload' && (
                <button onClick={handleValidate} disabled={!isReady || loading}
                  className="px-4 py-2 text-sm font-medium border rounded-lg disabled:opacity-50 transition-colors"
                  style={{ borderColor: '#194276', color: '#194276' }}>
                  {loading ? <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />Validando...</span> : 'Validar archivo'}
                </button>
              )}
              {step === 'preview' && (result?.valid ?? 0) > 0 && (
                <button onClick={handleImport} disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ background: '#194276' }}>
                  {loading ? <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Importando...</span> : `Importar ${result?.valid}`}
                </button>
              )}
              {step === 'done' && <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ background: '#194276' }}>Cerrar</button>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface PanelState { deliverable: Deliverable; tab: PanelTab; }
type FormMode = { mode: 'create' } | { mode: 'edit'; deliverable: Deliverable };

export default function EntregablesPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthContext();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';

  const [data, setData]         = useState<Deliverable[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterProject, setFilterProject]       = useState('');
  const [filterStatus, setFilterStatus]         = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [panel, setPanel]     = useState<PanelState | null>(null);
  const [toasts, setToasts]   = useState<ToastMsg[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('rows');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [formPanel, setFormPanel]     = useState<FormMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deliverable | null>(null);
  const [showImport, setShowImport]   = useState(false);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    api.get<Array<{ id: number; name: string }>>(ENDPOINTS.PROJECTS)
      .then(r => setProjects(Array.isArray(r) ? r : [])).catch(() => {});
    api.get<User[]>(ENDPOINTS.USERS)
      .then(r => setUsers(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (!filter) return;
    if (filter === 'overdue') setOnlyOverdue(true);
    else if (filter.startsWith('status_')) setFilterStatus(filter.replace('status_', ''));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoOpenedRef.current || data.length === 0) return;
    const deliverableIdStr = searchParams.get('deliverable');
    if (!deliverableIdStr) return;
    const target = data.find(d => d.id === Number(deliverableIdStr));
    if (target) {
      setPanel({ deliverable: target, tab: 'info' });
      autoOpenedRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    api.get<Deliverable[]>(ENDPOINTS.DELIVERABLES)
      .then(d => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const projectNames = useMemo(() => Array.from(new Set(data.map(d => d.project_name).filter(Boolean))) as string[], [data]);
  const programNames = useMemo(() => Array.from(new Set(data.map(d => d.program_name).filter(Boolean))) as string[], [data]);
  const responsibles = useMemo(() => Array.from(new Set(
    data.flatMap(d => (d.role_activities ?? []).map(a => a.responsible?.name).filter(Boolean))
  )) as string[], [data]);

  const COMPLETED_STATUSES = ['finished', 'cancelled'];

  const filtered = useMemo(() => data.filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (![d.name, d.subject_name, d.project_name, d.program_name].some(s => s?.toLowerCase().includes(q))) return false;
    }
    if (filterProject && d.project_name !== filterProject) return false;
    if (filterStatus && d.global_status !== filterStatus) return false;
    if (filterResponsible && !(d.role_activities ?? []).some(a => a.responsible?.name === filterResponsible)) return false;
    if (onlyOverdue && !isOverdue(d)) return false;
    // Hide completed unless the user explicitly filtered for them or toggled showCompleted
    if (!showCompleted && !COMPLETED_STATUSES.includes(filterStatus) && COMPLETED_STATUSES.includes(d.global_status)) return false;
    return true;
  }), [data, search, filterProject, filterStatus, filterResponsible, onlyOverdue, showCompleted]);

  const completedHiddenCount = useMemo(
    () => !showCompleted && !COMPLETED_STATUSES.includes(filterStatus)
      ? data.filter(d => COMPLETED_STATUSES.includes(d.global_status)).length
      : 0,
    [data, showCompleted, filterStatus]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, { programName: string; projectName: string; items: Deliverable[] }>();
    for (const d of filtered) {
      const key = d.program_name ?? '(Sin programa)';
      if (!map.has(key)) map.set(key, { programName: key, projectName: d.project_name ?? '—', items: [] });
      map.get(key)!.items.push(d);
    }
    return Array.from(map.values()).sort((a, b) => {
      // Active groups (have non-finished items) go first
      const aActive = a.items.some(d => !COMPLETED_STATUSES.includes(d.global_status));
      const bActive = b.items.some(d => !COMPLETED_STATUSES.includes(d.global_status));
      if (aActive !== bActive) return aActive ? -1 : 1;
      return a.programName.localeCompare(b.programName);
    });
  }, [filtered]);

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      if (prev.has(key)) return new Set();
      return new Set([key]);
    });
  }

  async function handleQuickAction(d: Deliverable, action: QuickAction) {
    const activity = action === 'deliver' ? getDeliverableActivity(d) : getActiveActivity(d);
    if (!activity) { addToast('No hay actividad en estado para esta acción.', 'error'); return; }
    try {
      await api.post(ENDPOINTS.ACTIVITY_QUICK_ACTION(activity.id), { action });
      addToast(action === 'approve' ? 'Aprobado.' : action === 'deliver' ? 'Entregado.' : 'Ajustes solicitados.', 'success');
      loadData();
    } catch (e: unknown) {
      const err = e as { requires_production?: boolean };
      if (err?.requires_production) {
        addToast('Esta actividad requiere registrar producción antes de entregar. Abre el detalle para registrarla.', 'error');
      } else {
        addToast('Error al ejecutar la acción.', 'error');
      }
    }
  }

  async function handleDelete(d: Deliverable) {
    try {
      await api.delete(ENDPOINTS.DELIVERABLE(d.id));
      addToast('Entregable eliminado.', 'success');
      setDeleteTarget(null);
      loadData();
    } catch { addToast('Error al eliminar.', 'error'); }
  }

  async function handleExport() {
    try { await downloadCsv(ENDPOINTS.EXPORT_DELIVERABLES, 'entregables.csv'); addToast('Exportación iniciada.', 'success'); }
    catch { addToast('Error al exportar.', 'error'); }
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Entregables"
        subtitle="Seguimiento por módulo con responsables, estados y fechas de compromiso por rol"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Entregables' }]}
      />

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-full sm:min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar asignatura, módulo, proyecto..."
            className="pl-8 pr-3 py-2 sm:py-1.5 text-sm border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-[#194276]/30" />
        </div>

        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30 sm:min-w-[150px]">
          <option value="">Todos los proyectos</option>
          {projectNames.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30 sm:min-w-[140px]">
          <option value="">Todos los estados</option>
          {Object.entries(GLOBAL_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#194276]/30 sm:min-w-[150px]">
          <option value="">Todos los responsables</option>
          {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <label className="flex min-h-10 items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 accent-red-500" />
          <span className="text-sm text-gray-600 flex items-center gap-1">
            <AlertCircle size={13} className="text-red-500" /> Solo vencidas
          </span>
        </label>

        <button
          onClick={() => setShowCompleted(p => !p)}
          className={clsx(
            'flex min-h-10 items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            showCompleted
              ? 'bg-gray-100 border-gray-300 text-gray-700'
              : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
          )}
        >
          <CheckCircle2 size={12} className={showCompleted ? 'text-emerald-500' : 'text-gray-300'} />
          {showCompleted ? 'Ocultar finalizados' : 'Ver finalizados'}
          {!showCompleted && completedHiddenCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
              {completedHiddenCount}
            </span>
          )}
        </button>

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>

          {/* Collapse groups */}
          <div className="flex flex-1 sm:flex-none items-center gap-1 border border-gray-200 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setExpandedGroups(new Set())}
              className="flex-1 sm:flex-none px-2.5 py-2 sm:py-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Contraer programas
            </button>
          </div>

          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('rows')} title="Vista detallada por roles"
              className={clsx('p-1.5 rounded-md transition-colors flex items-center gap-1',
                viewMode === 'rows' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600')}>
              <LayoutList size={15} />
              {viewMode === 'rows' && <span className="text-xs font-medium">Detallada</span>}
            </button>
            <button onClick={() => setViewMode('grouped')} title="Vista tabla compacta"
              className={clsx('p-1.5 rounded-md transition-colors flex items-center gap-1',
                viewMode === 'grouped' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600')}>
              <Table2 size={15} />
              {viewMode === 'grouped' && <span className="text-xs font-medium">Tabla</span>}
            </button>
          </div>

          {isManager && (
            <>
              <button onClick={() => setFormPanel({ mode: 'create' })}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-sm font-medium text-white rounded-lg"
                style={{ background: '#194276' }}>
                <Plus size={14} /> Nueva tarea
              </button>
              <button onClick={() => setShowImport(true)}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-sm font-medium border rounded-lg transition-colors"
                style={{ borderColor: '#194276', color: '#194276' }}>
                <Upload size={14} /> Carga Masiva
              </button>
            </>
          )}

          <button onClick={handleExport}
            className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={14} /> Exportar
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <TableSkeleton rows={5} cols={6} />
        </div>
      )}

      {/* ── ROWS VIEW (detailed, primary) ─────────────────────────────────── */}
      {viewMode === 'rows' && !loading && (
        <div className="space-y-3">
          {grouped.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-14 text-center text-sm text-gray-400">
              <Filter size={32} className="mx-auto mb-2 opacity-30" />
              No se encontraron entregables con los filtros aplicados.
            </div>
          )}
          {grouped.map(group => {
            const isCollapsed = !expandedGroups.has(group.programName);
            return (
              <div key={group.programName} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <GroupHeader
                  programName={group.programName} projectName={group.projectName} items={group.items}
                  groupKey={group.programName} isCollapsed={isCollapsed}
                  onToggle={() => toggleGroup(group.programName)}
                />
                {!isCollapsed && (
                  <>
                    {group.items.map(d => (
                      <DeliverableRow
                        key={d.id} deliverable={d} isManager={isManager}
                        onView={() => setPanel({ deliverable: d, tab: 'info' })}
                        onEdit={() => setFormPanel({ mode: 'edit', deliverable: d })}
                        onDelete={() => setDeleteTarget(d)}
                        onQuickAction={action => handleQuickAction(d, action)}
                      />
                    ))}
                    {isManager && (
                      <div className="px-5 py-3 border-t border-dashed border-gray-100 bg-gray-50/40">
                        <button onClick={() => setFormPanel({ mode: 'create' })}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#194276] transition-colors">
                          <Plus size={12} /> Agregar módulo en este programa
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-3 px-1">
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <Clock size={11} /> {filtered.length} de {data.length} entregable{data.length !== 1 ? 's' : ''}
              <span className="mx-1 text-gray-200">·</span>El avance excluye roles marcados como N/A
            </p>
            {completedHiddenCount > 0 && (
              <button onClick={() => setShowCompleted(true)} className="text-xs text-indigo-500 hover:text-indigo-700 underline">
                {completedHiddenCount} finalizado{completedHiddenCount !== 1 ? 's' : ''} oculto{completedHiddenCount !== 1 ? 's' : ''} — ver
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── TABLE VIEW (secondary, compact) ──────────────────────────────── */}
      {viewMode === 'grouped' && !loading && (
        <div className="space-y-3">
          {grouped.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
              <Filter size={32} className="mx-auto mb-2 opacity-30" />
              No se encontraron entregables.
            </div>
          )}
          {grouped.map(group => {
            const tableKey = group.programName + '_table';
            const isCollapsed = !expandedGroups.has(tableKey);
            return (
              <div key={group.programName} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <GroupHeader
                  programName={group.programName} projectName={group.projectName} items={group.items}
                  groupKey={tableKey} isCollapsed={isCollapsed}
                  onToggle={() => toggleGroup(tableKey)}
                />
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[860px]">
                      <thead className="bg-gray-50/80 border-b border-gray-100">
                        <tr>
                          {['Asignatura / Módulo','Tipo','Estado','Responsable activo','F. Compromiso','Avance (excl. N/A)','Acciones'].map(h => (
                            <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(d => {
                          const acts = d.role_activities ?? [];
                          const active = getActiveActivity(d);
                          const days = daysUntil(active?.commitment_date);
                          const overdue = days !== null && days < 0 && d.global_status !== 'finished';
                          return (
                            <tr key={d.id} className={clsx(
                              'border-b border-gray-50 dark:border-gray-700 hover:bg-blue-50/20 dark:hover:bg-gray-700/30 transition-colors relative',
                              overdue && 'border-l-4 border-l-red-500'
                            )}>
                              <td className="px-3 py-2.5 max-w-[200px]">
                                <p className="font-semibold text-gray-900 text-xs truncate">{d.subject_name ?? '—'}</p>
                                <p className="text-[10px] text-gray-400 truncate">{d.name}</p>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                  d.type === 'creation' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                                )}>{DELIVERABLE_TYPE_LABELS[d.type]}</span>
                              </td>
                              <td className="px-3 py-2.5"><StatusBadge status={d.global_status} type="global" /></td>
                              <td className="px-3 py-2.5 text-xs">
                                {active ? (
                                  <div>
                                    <p className="font-medium text-gray-800 truncate max-w-[120px]">{active.responsible?.name ?? '—'}</p>
                                    <p className="text-[10px] text-gray-400">{ROLE_LABELS[active.role]}</p>
                                  </div>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className={clsx('text-xs', overdue ? 'text-red-600 font-semibold' : 'text-gray-600')}>
                                  {formatDate(active?.commitment_date)}
                                </span>
                                {overdue && <span className="ml-1 text-[9px] text-red-500 font-bold">({Math.abs(days!)}d)</span>}
                              </td>
                              <td className="px-3 py-2.5"><ProgressExcNA activities={acts} compact /></td>
                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-0.5">
                                  <button title="Ver" onClick={() => setPanel({ deliverable: d, tab: 'info' })}
                                    className="p-1.5 rounded-md text-gray-400 hover:text-[#194276] hover:bg-blue-50 transition-colors"><Eye size={13} /></button>
                                  {isManager && (
                                    <>
                                      <button title="Editar" onClick={() => setFormPanel({ mode: 'edit', deliverable: d })}
                                        className="p-1.5 rounded-md text-gray-400 hover:text-[#194276] hover:bg-blue-50 transition-colors"><Pencil size={13} /></button>
                                      <button title="Eliminar" onClick={() => setDeleteTarget(d)}
                                        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                                    </>
                                  )}
                                  {(d.global_status === 'in_review' || d.global_status === 'with_observations') && (
                                    <button title="Aprobar" onClick={() => handleQuickAction(d, 'approve')}
                                      className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"><CheckCircle2 size={13} /></button>
                                  )}
                                  {d.global_status === 'in_progress' && (
                                    <button title="Entregar" onClick={() => handleQuickAction(d, 'deliver')}
                                      className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"><Send size={13} /></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-3 px-1">
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <Clock size={11} /> {filtered.length} de {data.length} entregable{data.length !== 1 ? 's' : ''}
            </p>
            {completedHiddenCount > 0 && (
              <button onClick={() => setShowCompleted(true)} className="text-xs text-indigo-500 hover:text-indigo-700 underline">
                {completedHiddenCount} finalizado{completedHiddenCount !== 1 ? 's' : ''} oculto{completedHiddenCount !== 1 ? 's' : ''} — ver
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Panels & Modals ───────────────────────────────────────────────── */}
      {panel && <SidePanel deliverable={panel.deliverable} defaultTab={panel.tab} onClose={() => setPanel(null)} />}

      {formPanel && (
        <DeliverableFormPanel
          mode={formPanel.mode}
          deliverable={formPanel.mode === 'edit' ? formPanel.deliverable : undefined}
          projects={projects} users={users} programs={programNames}
          onClose={() => setFormPanel(null)}
          onSave={(updated) => {
            setFormPanel(null);
            if (updated) {
              setData(prev => prev.map(d => d.id === updated.id ? updated : d));
            } else {
              loadData();
            }
          }}
          addToast={addToast}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm name={deleteTarget.name} onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}

      {showImport && (
        <BulkImportModal projects={projects} onClose={() => setShowImport(false)} onSuccess={loadData} addToast={addToast} />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}
