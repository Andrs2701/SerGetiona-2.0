'use client';

import { clsx } from 'clsx';
import type { HealthLevel } from '@/lib/types';
import { HEALTH_LEVEL_LABELS } from '@/lib/types';

interface HealthBadgeProps {
  level: HealthLevel;
  score?: number;
  size?: 'sm' | 'md';
}

const LEVEL_STYLES: Record<HealthLevel, { dot: string; pill: string }> = {
  green: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  yellow: { dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700' },
  red: { dot: 'bg-red-500', pill: 'bg-red-50 text-red-700' },
};

export default function HealthBadge({ level, score, size = 'md' }: HealthBadgeProps) {
  const styles = LEVEL_STYLES[level];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        styles.pill,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      )}
    >
      <span className={clsx('rounded-full', styles.dot, size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5')} />
      {HEALTH_LEVEL_LABELS[level]}
      {score !== undefined && <span className="opacity-70">· {score}</span>}
    </span>
  );
}
