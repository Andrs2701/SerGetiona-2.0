'use client';

import { clsx } from 'clsx';
import type { DateStatus } from '@/lib/types';

interface DateStatusBadgeProps {
  date_status: DateStatus;
  commitment_date?: string;
  show_date?: boolean;
  size?: 'sm' | 'md';
}

function getDaysOverdue(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function DateStatusBadge({
  date_status,
  commitment_date,
  show_date = true,
  size = 'sm',
}: DateStatusBadgeProps) {
  const base = clsx(
    'inline-flex items-center gap-1 rounded-full font-medium',
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  );

  if (date_status === 'completed') {
    return (
      <span className={clsx(base, 'bg-emerald-100 text-emerald-800')}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
        Completado
        {show_date && commitment_date && ` · ${formatDate(commitment_date)}`}
      </span>
    );
  }

  if (date_status === 'overdue') {
    const days = commitment_date ? getDaysOverdue(commitment_date) : 0;
    return (
      <span className={clsx(base, 'bg-red-100 text-red-800')}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
        Vencido{days > 0 ? ` (${days}d)` : ''}
        {show_date && commitment_date && ` · ${formatDate(commitment_date)}`}
      </span>
    );
  }

  if (date_status === 'approaching') {
    return (
      <span className={clsx(base, 'bg-amber-100 text-amber-800')}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
        Por vencer
        {show_date && commitment_date && ` · ${formatDate(commitment_date)}`}
      </span>
    );
  }

  if (date_status === 'on_time') {
    return (
      <span className={clsx(base, 'bg-green-100 text-green-800')}>
        <span className="w-1.5 h-1.5 rounded-full bg-green-600 flex-shrink-0" />
        A tiempo
        {show_date && commitment_date && ` · ${formatDate(commitment_date)}`}
      </span>
    );
  }

  // not_applicable
  return (
    <span className={clsx(base, 'bg-gray-100 text-gray-500')}>
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
      N/A
    </span>
  );
}
