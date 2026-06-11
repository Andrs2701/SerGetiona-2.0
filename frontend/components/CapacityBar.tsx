'use client';

import { clsx } from 'clsx';
import type { CapacityStatus } from '@/lib/types';

interface CapacityBarProps {
  utilizationPct: number;
  status: CapacityStatus;
  /** Texto pequeño a la derecha (p. ej. "8 / 10 pts") */
  detail?: string;
}

const BAR_COLORS: Record<CapacityStatus, string> = {
  ok: 'bg-emerald-500',
  high: 'bg-amber-400',
  overloaded: 'bg-red-500',
};

export default function CapacityBar({ utilizationPct, status, detail }: CapacityBarProps) {
  const width = Math.min(100, utilizationPct);

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', BAR_COLORS[status])}
          style={{ width: `${width}%` }}
        />
      </div>
      <span
        className={clsx(
          'text-xs font-semibold w-14 text-right',
          status === 'overloaded' ? 'text-red-600' : status === 'high' ? 'text-amber-600' : 'text-emerald-600'
        )}
      >
        {utilizationPct.toFixed(0)}%
      </span>
      {detail && <span className="text-xs text-gray-400 w-20 text-right">{detail}</span>}
    </div>
  );
}
