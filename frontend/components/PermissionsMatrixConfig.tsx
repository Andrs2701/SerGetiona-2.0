'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save, ShieldCheck, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import type { SystemPermission, SystemRole, VisibilityRule } from '@/lib/types';

const MODULE_LABELS: Record<string, string> = {
  projects: 'Proyectos',
  users: 'Usuarios',
  configuracion: 'Configuración',
  reportes: 'Reportes',
  colaboracion: 'Colaboración',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'Ver',
  manage: 'Gestionar',
  manage_channels: 'Administrar canales',
};

export default function PermissionsMatrixConfig() {
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [rules, setRules] = useState<VisibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [permRes, roleRes, ruleRes] = await Promise.all([
        api.get<{ permissions: SystemPermission[] }>('/config/permissions'),
        api.get<{ roles: SystemRole[] }>('/config/roles'),
        api.get<{ visibility_rules: VisibilityRule[] }>('/config/visibility-rules'),
      ]);
      setPermissions(permRes.permissions ?? []);
      setRoles((roleRes.roles ?? []).filter((r) => r.is_active));
      setRules(ruleRes.visibility_rules ?? []);
    } catch {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function togglePermission(permId: number, roleSlug: string) {
    if (roleSlug === 'admin') return; // admin siempre tiene acceso
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.id !== permId) return p;
        const has = p.allowed_roles.includes(roleSlug);
        return {
          ...p,
          allowed_roles: has
            ? p.allowed_roles.filter((r) => r !== roleSlug)
            : [...p.allowed_roles, roleSlug],
        };
      })
    );
    setDirty(true);
    setFeedback(null);
  }

  function toggleScope(roleSlug: string) {
    setRules((prev) => {
      const existing = prev.find((r) => r.role_slug === roleSlug);
      if (existing) {
        return prev.map((r) =>
          r.role_slug === roleSlug
            ? { ...r, scope: r.scope === 'all' ? 'assigned_only' : 'all' }
            : r
        );
      }
      return [...prev, { id: 0, role_slug: roleSlug, scope: 'all' }];
    });
    setDirty(true);
    setFeedback(null);
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      await Promise.all([
        api.put('/config/permissions', {
          permissions: permissions.map((p) => ({ id: p.id, allowed_roles: p.allowed_roles })),
        }),
        api.put('/config/visibility-rules', {
          rules: rules.map((r) => ({ role_slug: r.role_slug, scope: r.scope })),
        }),
      ]);
      setDirty(false);
      setFeedback('Cambios guardados correctamente.');
    } catch {
      setFeedback('No se pudieron guardar los cambios. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Cargando matriz de permisos…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm text-gray-500 max-w-2xl">
          Define qué roles pueden acceder a cada módulo. El rol <strong>Administrador</strong> siempre
          tiene acceso total y no puede modificarse. Los cambios aplican de inmediato a toda la plataforma.
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          {feedback && (
            <span className={clsx('text-xs', feedback.startsWith('No') ? 'text-red-600' : 'text-emerald-600')}>
              {feedback}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
          >
            <Save size={15} />
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Matriz módulos × roles. Con 8 roles la tabla es más ancha que casi
          cualquier pantalla, así que la primera columna queda fija (sticky)
          para que el nombre del módulo no se pierda al desplazar hacia la
          derecha, y un degradado en el borde derecho avisa que hay más
          columnas para ver (antes no había ninguna pista visual de esto). */}
      <div className="relative">
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">
                  <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> Módulo / Acción</span>
                </th>
                {roles.map((r) => (
                  <th key={r.slug} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.id} className="group border-b border-gray-50 hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 px-5 py-3 border-r border-gray-200">
                    <p className="font-medium text-gray-900">
                      {MODULE_LABELS[p.module] ?? p.module}
                      <span className="text-gray-400 font-normal"> · {ACTION_LABELS[p.action] ?? p.action}</span>
                    </p>
                    {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                  </td>
                  {roles.map((r) => {
                    const checked = r.slug === 'admin' || p.allowed_roles.includes(r.slug);
                    return (
                      <td key={r.slug} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={r.slug === 'admin'}
                          onChange={() => togglePermission(p.id, r.slug)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {permissions.length === 0 && (
                <tr>
                  <td colSpan={roles.length + 1} className="px-5 py-8 text-center text-gray-400">
                    No hay permisos configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Degradado que insinúa que hay más columnas a la derecha */}
        <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent rounded-r-lg" />
      </div>
      <p className="text-xs text-gray-400 sm:hidden -mt-4">Desliza la tabla hacia la izquierda para ver todos los roles →</p>

      {/* Alcance de visibilidad por rol */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
          <Eye size={15} className="text-gray-400" />
          Alcance de visibilidad
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          Controla si cada rol ve todos los proyectos o únicamente aquellos donde tiene actividades asignadas.
        </p>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
          {roles.map((r) => {
            const rule = rules.find((x) => x.role_slug === r.slug);
            const seesAll = r.slug === 'admin' || (rule?.scope ?? 'assigned_only') === 'all';
            return (
              <div key={r.slug} className="px-5 py-3 flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-gray-900">{r.name}</p>
                <button
                  onClick={() => r.slug !== 'admin' && toggleScope(r.slug)}
                  disabled={r.slug === 'admin'}
                  className={clsx(
                    'px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
                    seesAll
                      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
                    r.slug === 'admin' && 'cursor-not-allowed opacity-70'
                  )}
                >
                  {seesAll ? 'Ve todo' : 'Solo asignados'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
