'use client';

import { USER_ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';

interface NextResponsibleCardProps {
  nextRole?: string;
  nextResponsible?: string;
  nextDate?: string;
}

const ROLE_COLORS: Record<string, string> = {
  expert: 'bg-amber-100 text-amber-800',
  pedagogy: 'bg-purple-100 text-purple-800',
  design: 'bg-pink-100 text-pink-800',
  audiovisual: 'bg-violet-100 text-violet-800',
  engineering: 'bg-cyan-100 text-cyan-800',
  qa: 'bg-emerald-100 text-emerald-800',
};

export default function NextResponsibleCard({
  nextRole,
  nextResponsible,
  nextDate,
}: NextResponsibleCardProps) {
  if (!nextRole) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 text-center">
        Etapa final — Pendiente Calidad / Proceso completado
      </div>
    );
  }

  const roleLabel = (USER_ROLE_LABELS as Record<string, string>)[nextRole] ?? nextRole;
  const roleColor = ROLE_COLORS[nextRole] ?? 'bg-blue-100 text-blue-800';
  const initial = nextResponsible ? nextResponsible.charAt(0).toUpperCase() : '?';

  const formattedDate = nextDate
    ? new Date(nextDate + 'T12:00:00').toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-sm font-bold flex-shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-blue-500 font-medium mb-0.5">Próximo responsable</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-blue-900 truncate">
            {nextResponsible ?? 'Sin asignar'}
          </span>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${roleColor}`}>
            {roleLabel}
          </span>
        </div>
        {formattedDate && (
          <p className="text-xs text-blue-500 mt-0.5">Fecha límite: {formattedDate}</p>
        )}
      </div>
    </div>
  );
}
