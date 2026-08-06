import type { Notification } from '@/lib/types';

/**
 * Resuelve a dónde navegar al hacer clic en una notificación. Única fuente
 * de verdad para la navegación de notificaciones desde cualquier punto de la app
 * e independientemente del rol del usuario.
 */
export function getNotifRoute(n: Notification, userRole?: string): string | null {
  const isManager = userRole === 'admin' || userRole === 'coordinator';
  const d = n.data ?? {};
  const actId = d.activity_id ?? d.role_activity_id ?? (d.entity_type === 'RoleActivity' ? d.entity_id : undefined);
  const channelId = d.channel_id ?? (d.entity_type === 'Channel' ? d.entity_id : undefined);
  const deliverableId = d.deliverable_id ?? (d.entity_type === 'Deliverable' ? d.entity_id : undefined);

  if (n.type === 'mention' && channelId) return `/colaboracion?channel=${channelId}`;
  if (n.type === 'channel_added' && channelId) return `/colaboracion?channel=${channelId}`;
  if (n.type === 'decision_assigned') return isManager ? '/decisiones' : '/mi-espacio';

  // Si la notificación está asociada a un entregable o actividad de entregable,
  // redirige directamente a la vista de Entregables abriendo el detalle.
  if (deliverableId && actId) {
    return `/entregables?deliverable=${deliverableId}&activity=${actId}`;
  }
  if (deliverableId) {
    return `/entregables?deliverable=${deliverableId}`;
  }
  if (actId) {
    return `/entregables?activity=${actId}`;
  }

  if (['task_assigned', 'status_changed', 'date_changed', 'adjustments_requested', 'activity_modified',
       'next_in_chain', 'deadline_approaching', 'overdue', 'overdue_reminder', 'comment_added',
       'deliverable_approved', 'deliverable_rejected', 'deliverable_observation'].includes(n.type)) {
    return '/entregables';
  }

  return '/entregables';
}
