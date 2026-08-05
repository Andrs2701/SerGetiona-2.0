import { clsx } from 'clsx';
import type { ProjectStatus, GlobalStatus } from '@/lib/types';
import {
  PROJECT_STATUS_LABELS,
  GLOBAL_STATUS_LABELS,
  ROLE_STATUS_LABELS,
} from '@/lib/types';

const ROLE_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  not_started: 'bg-gray-100 text-gray-600',
  pending: 'bg-gray-100 text-gray-600',
  draft: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  in_development: 'bg-blue-100 text-blue-700',
  in_review: 'bg-purple-100 text-purple-700',
  with_observations: 'bg-orange-100 text-orange-700',
  with_findings: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700',
  not_applicable: 'bg-gray-50 text-gray-500',
  adjustments_requested: 'bg-amber-100 text-amber-700',
  delivered: 'bg-teal-100 text-teal-700',
  adjusting: 'bg-amber-100 text-amber-700',
  designing: 'bg-indigo-100 text-indigo-700',
  production: 'bg-violet-100 text-violet-700',
  editing: 'bg-pink-100 text-pink-700',
  implementing: 'bg-cyan-100 text-cyan-700',
  validating: 'bg-sky-100 text-sky-700',
  in_testing: 'bg-sky-100 text-sky-700',
};

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_params: 'bg-amber-100 text-amber-700',
  parameterized: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-700',
  finished: 'bg-gray-200 text-gray-700',
  cancelled: 'bg-red-200 text-red-800',
};

const GLOBAL_STATUS_COLORS: Record<GlobalStatus, string> = {
  unpublished: 'bg-gray-100 text-gray-600',
  pending_start: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review: 'bg-purple-100 text-purple-700',
  with_observations: 'bg-orange-100 text-orange-700',
  finished: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  not_applicable: 'bg-gray-50 text-gray-500',
};

interface StatusBadgeProps {
  status: string;
  type?: 'project' | 'global' | 'role';
  size?: 'sm' | 'md';
  className?: string;
  /**
   * Con ambas presentes: si ya entregó más de una vez (la fecha de esta
   * entrega no es la primera), se muestra "Ajustes Realizados" en vez de
   * "Entregado"/"Aprobado" — sigue siendo funcionalmente delivered/approved,
   * solo cambia el texto para que quede claro que pasó por un ciclo de
   * hallazgos. Sin estas props, el badge se comporta igual que siempre.
   */
  firstDeliveredAt?: string | null;
  actualDeliveryDate?: string | null;
}

export default function StatusBadge({
  status,
  type = 'global',
  size = 'sm',
  className,
  firstDeliveredAt,
  actualDeliveryDate,
}: StatusBadgeProps) {
  let label = status;
  let colorClass = 'bg-gray-100 text-gray-700';

  if (type === 'project') {
    label = PROJECT_STATUS_LABELS[status as ProjectStatus] ?? status;
    colorClass = PROJECT_STATUS_COLORS[status as ProjectStatus] ?? colorClass;
  } else if (type === 'global') {
    label = GLOBAL_STATUS_LABELS[status as GlobalStatus] ?? status;
    colorClass = GLOBAL_STATUS_COLORS[status as GlobalStatus] ?? colorClass;
  } else if (type === 'role') {
    label = ROLE_STATUS_LABELS[status] ?? status;
    colorClass = ROLE_STATUS_COLORS[status] ?? colorClass;

    const wasReturned = (status === 'delivered' || status === 'approved')
      && !!firstDeliveredAt && !!actualDeliveryDate
      && firstDeliveredAt !== actualDeliveryDate;
    if (wasReturned) {
      label = 'Ajustes Realizados';
    }
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}
