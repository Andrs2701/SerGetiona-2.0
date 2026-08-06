import type { Notification } from '@/lib/types';

/**
 * Resuelve a dónde navegar al hacer clic en una notificación. Única fuente
 * de verdad — la usan tanto el desplegable de la campana (Header.tsx) como
 * la página de notificaciones, para que no se desincronicen entre sí.
 *
 * Managers (admin/coordinador) van a Entregables: ahí ven el detalle desde
 * la vista de supervisión, con deliverable+activity combinados cuando ambos
 * se conocen (mejor resolución del entregable padre; el panel siempre abre
 * la vista de INFORMACIÓN sin importar si se pasó uno u otro).
 * Roles operativos van a Mi Espacio — su propia notificación (que le
 * asignaron una tarea, que le devolvieron ajustes, etc.) es sobre SU
 * actividad, no tiene sentido llevarlos a la vista gerencial de Entregables.
 */
export function getNotifRoute(n: Notification, userRole?: string): string | null {
  const isManager = userRole === 'admin' || userRole === 'coordinator';
  const d = n.data ?? {};
  const actId = d.activity_id ?? d.role_activity_id ?? (d.entity_type === 'RoleActivity' ? d.entity_id : undefined);
  const channelId = d.channel_id ?? (d.entity_type === 'Channel' ? d.entity_id : undefined);
  const deliverableId = d.deliverable_id ?? (d.entity_type === 'Deliverable' ? d.entity_id : undefined);

  if (n.type === 'mention' && channelId) return `/colaboracion?channel=${channelId}`;
  if (n.type === 'channel_added' && channelId) return `/colaboracion?channel=${channelId}`;
  if (n.type === 'comment_added' && deliverableId) return `/entregables?filter=status_in_review`;
  if (n.type === 'deliverable_approved' || n.type === 'deliverable_rejected' || n.type === 'deliverable_observation') return '/entregables';
  if (n.type === 'decision_assigned') return isManager ? '/decisiones' : '/mi-espacio';

  if (isManager) {
    if (deliverableId && actId) return `/entregables?deliverable=${deliverableId}&activity=${actId}`;
    if (deliverableId) return `/entregables?deliverable=${deliverableId}`;
    if (actId) return `/entregables?activity=${actId}`;
    return '/entregables';
  }

  if (actId) return `/mi-espacio?highlight=${actId}&open=${actId}`;
  if (['task_assigned', 'status_changed', 'date_changed', 'adjustments_requested', 'activity_modified',
       'next_in_chain', 'deadline_approaching', 'overdue', 'overdue_reminder'].includes(n.type)) return '/mi-espacio';
  return null;
}
