import type { User } from './types';

/** ¿Tiene este usuario el permiso "modulo.accion" según la Matriz de Permisos? */
export function can(user: User | null | undefined, module: string, action: string): boolean {
  return !!user?.permissions?.includes(`${module}.${action}`);
}
