import type { Notification } from '@/lib/types';

/**
 * Resuelve a dónde navegar al hacer clic en una notificación. Única fuente
 * de verdad — antes vivía duplicada en Header.tsx y en notificaciones/page.tsx
 * y las dos copias se fueron desincronizando (una traía el fallback por
 * entity_type y la otra no, por ejemplo), lo que hacía que un mismo clic
 * abriera la vista correcta desde un lado y desde el otro no.
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
    if (deliverableId) return `/entregables?deliverable=${deliverableId}`;
    return '/entregables';
  }

  if (actId) return `/mi-espacio?highlight=${actId}&open=${actId}`;
  if (['task_assigned', 'status_changed', 'date_changed', 'adjustments_requested', 'activity_modified',
       'next_in_chain', 'deadline_approaching', 'overdue', 'overdue_reminder'].includes(n.type)) return '/mi-espacio';
  return null;
}
