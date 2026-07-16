// Agrupaciones de estados de actividad compartidas por la UI.
//
// Ojo con los nombres: solo NOT_OVERDUE_STATUSES refleja una constante del
// backend (RoleActivity::NOT_OVERDUE_STATUSES). Las otras dos son criterios
// propios de la interfaz y NO existen igual en el backend — por eso no reusan
// sus nombres. En particular, RoleActivity::INACTIVE_STATUSES del backend
// incluye 'not_started' (sirve para el scope active() de los reportes), que
// aquí sería un error: una actividad sin iniciar es justamente la que el
// operario tiene pendiente por hacer.

/** Espejo de RoleActivity::NOT_OVERDUE_STATUSES. Nunca cuentan como vencidas. */
export const NOT_OVERDUE_STATUSES = ['approved', 'delivered', 'not_applicable'];

/**
 * Lo que un operario ya no tiene que atender: se oculta de su vista de trabajo
 * por defecto y aparece bajo el filtro de completadas. 'not_applicable' entra
 * aquí para que se comporte igual que 'delivered', que es lo que se pidió.
 */
export const HIDDEN_IN_WORKSPACE_STATUSES = ['approved', 'delivered', 'not_applicable'];

/**
 * Lo que un gestor considera cerrado. No incluye 'delivered' ni 'in_review' a
 * propósito: son exactamente las que tiene pendientes por revisar.
 */
export const DONE_STATUSES = ['approved', 'not_applicable'];
