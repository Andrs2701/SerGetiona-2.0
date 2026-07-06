'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Search, AlertCircle, KeyRound, Copy, Check, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { api, ENDPOINTS } from '@/lib/api';
import type { User, UserRole } from '@/lib/types';
import { USER_ROLE_LABELS } from '@/lib/types';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import Avatar from '@/components/Avatar';
import { useAuthContext } from '@/contexts/AuthContext';

function parseApiError(err: unknown): string {
  if (!(err instanceof Error)) return 'No se pudo guardar el usuario. Intenta de nuevo.';
  const body = err.message.replace(/^HTTP \d+:\s*/, '');
  try {
    const parsed = JSON.parse(body) as { message?: string; errors?: Record<string, string[]> };
    const firstFieldError = parsed.errors && Object.values(parsed.errors)[0]?.[0];
    return firstFieldError ?? parsed.message ?? body;
  } catch {
    return body || 'No se pudo guardar el usuario. Intenta de nuevo.';
  }
}

const USER_ROLES: UserRole[] = [
  'admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa',
];

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border border-purple-200/50',
  coordinator: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200/50',
  expert: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200/50',
  pedagogy: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200/50',
  design: 'bg-pink-100 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300 border border-pink-200/50',
  audiovisual: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 border border-orange-200/50',
  engineering: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 border border-indigo-200/50',
  qa: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200/20',
};

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  is_active: boolean;
  weekly_capacity_points: string;
}

const emptyForm: UserForm = {
  name: '',
  email: '',
  password: '',
  role: 'expert',
  phone: '',
  is_active: true,
  weekly_capacity_points: '',
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={clsx('rounded-xl border px-5 py-4 transition-all hover:shadow-sm flex-1 min-w-[140px]', color)}>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-xs mt-0.5 opacity-75 font-medium">{label}</p>
    </div>
  );
}

function formatLastActive(seconds?: number | null, iso?: string | null): string {
  if (seconds === undefined || seconds === null) return 'Nunca';
  const diffMins = Math.floor(seconds / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;

  if (iso) {
    const last = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (last.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }
    return last.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return 'Hace más de un día';
}

export default function UsuariosPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  
  const isManagement = user?.role === 'admin';

  const [data, setData] = useState<User[]>([]);
  const [dataLoadedAt, setDataLoadedAt] = useState(Date.now());
  const [nowTick, setNowTick] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  
  // Sort states
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'last_active_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [resetLinkUser, setResetLinkUser] = useState<User | null>(null);
  const [resetLinkUrl, setResetLinkUrl] = useState('');
  const [resetLinkExpires, setResetLinkExpires] = useState(60);
  const [resetLinkLoading, setResetLinkLoading] = useState(false);
  const [resetLinkError, setResetLinkError] = useState('');
  const [resetLinkCopied, setResetLinkCopied] = useState(false);

  // Tick cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsersSilent = useCallback(() => {
    api
      .get<User[]>(ENDPOINTS.USERS)
      .then((res) => {
        setData(res);
        setDataLoadedAt(Date.now());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'coordinator') {
      router.replace('/');
      return;
    }

    setLoading(true);
    api
      .get<User[]>(ENDPOINTS.USERS)
      .then((res) => {
        setData(res);
        setDataLoadedAt(Date.now());
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [user, router]);

  // Polling cada 30s
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'coordinator')) return;
    const interval = setInterval(fetchUsersSilent, 30000);
    return () => clearInterval(interval);
  }, [user, fetchUsersSilent]);

  function openCreate() {
    setEditUser(null);
    setForm(emptyForm);
    setSaveError('');
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      phone: u.phone ?? '',
      is_active: u.is_active,
      weekly_capacity_points:
        u.weekly_capacity_points != null ? String(u.weekly_capacity_points) : '',
    });
    setSaveError('');
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    const payload = {
      ...form,
      weekly_capacity_points:
        form.weekly_capacity_points === '' ? null : Number(form.weekly_capacity_points),
    };
    try {
      if (editUser) {
        const updated = await api.put<User>(ENDPOINTS.USER(editUser.id), payload);
        setData((prev) => prev.map((u) => (u.id === editUser.id ? updated : u)));
      } else {
        const created = await api.post<User>(ENDPOINTS.USERS, payload);
        setData((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      setSaveError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    const updated = { ...u, is_active: !u.is_active };
    setData((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    try {
      await api.put(ENDPOINTS.USER(u.id), { is_active: updated.is_active });
    } catch {
      // revert silently
    }
  }

  async function handleGenerateResetLink(u: User) {
    setResetLinkUser(u);
    setResetLinkUrl('');
    setResetLinkError('');
    setResetLinkCopied(false);
    setResetLinkLoading(true);
    try {
      const res = await api.post<{ url: string; expires_in_minutes: number }>(ENDPOINTS.USER_RESET_LINK(u.id), {});
      setResetLinkUrl(res.url);
      setResetLinkExpires(res.expires_in_minutes);
    } catch (err) {
      setResetLinkError(parseApiError(err));
    } finally {
      setResetLinkLoading(false);
    }
  }

  async function handleCopyResetLink() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(resetLinkUrl);
        setResetLinkCopied(true);
        return;
      } catch (err) {
        console.error('Failed to copy using clipboard API, trying fallback:', err);
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = resetLinkUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        setResetLinkCopied(true);
      } else {
        alert('No se pudo copiar el enlace automáticamente. Por favor, selecciónalo y cópialo manualmente.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('No se pudo copiar el enlace. Por favor, selecciónalo y cópialo manualmente.');
    }
  }

  const handleSort = (field: 'name' | 'role' | 'last_active_at') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const usersWithPresence = useMemo(() => {
    const secondsElapsed = Math.floor((nowTick - dataLoadedAt) / 1000);
    return data.map((u) => {
      const activeDiffSeconds = u.active_diff_seconds !== null && u.active_diff_seconds !== undefined
        ? u.active_diff_seconds + secondsElapsed
        : null;
      const thresholdSeconds = u.online_threshold_seconds ?? 300;
      const isOnline = activeDiffSeconds !== null && activeDiffSeconds <= thresholdSeconds;

      return {
        ...u,
        activeDiffSeconds,
        isOnline,
      };
    });
  }, [data, nowTick, dataLoadedAt]);

  const filtered = useMemo(() => {
    return usersWithPresence
      .filter(
        (u) =>
          (!search ||
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())) &&
          (!filterRole || u.role === filterRole)
      )
      .sort((a, b) => {
        let valA: string = '';
        let valB: string = '';

        if (sortBy === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortBy === 'role') {
          valA = a.role;
          valB = b.role;
        } else if (sortBy === 'last_active_at') {
          valA = a.last_active_at ?? '';
          valB = b.last_active_at ?? '';
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [usersWithPresence, search, filterRole, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const total = usersWithPresence.length;
    const online = usersWithPresence.filter((u) => u.isOnline).length;
    const inactive = total - online;
    return { total, online, inactive };
  }, [usersWithPresence]);

  function SortHeader({ field, label }: { field: 'name' | 'role' | 'last_active_at'; label: string }) {
    const active = sortBy === field;
    return (
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-indigo-600 font-semibold text-xs uppercase transition-colors focus:outline-none"
      >
        {label}
        {active ? (
          sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de usuarios del sistema"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Usuarios' }]}
        actions={
          isManagement ? (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Nuevo Usuario
            </button>
          ) : undefined
        }
      />

      {/* Resumen de estadísticas (StatCards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total usuarios" value={stats.total} color="bg-white border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" />
        <StatCard label="En línea ahora" value={stats.online} color="bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-300" />
        <StatCard label="Desconectados" value={stats.inactive} color="bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800/40 dark:border-gray-700/50 dark:text-gray-400" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuarios..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div className="w-full sm:w-auto">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos los roles</option>
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {USER_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-5 py-3 text-left">
                      <SortHeader field="name" label="Nombre" />
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="px-5 py-3 text-left">
                      <SortHeader field="role" label="Rol" />
                    </th>
                    <th className="px-5 py-3 text-left">
                      <SortHeader field="last_active_at" label="Último Acceso" />
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    {isManagement && (
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar
                              name={u.name}
                              photoUrl={u.photo_url}
                              className="w-8 h-8 bg-indigo-100 text-indigo-700 text-xs font-bold"
                            />
                            {/* Punto de estado En Línea */}
                            <span
                              className={clsx(
                                'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800',
                                u.isOnline ? 'bg-emerald-500' : 'bg-gray-300'
                              )}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{u.name}</p>
                            {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[u.role])}>
                          {USER_ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 font-medium text-xs">
                        {formatLastActive(u.activeDiffSeconds, u.last_active_at)}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => isManagement && toggleActive(u)}
                          disabled={!isManagement}
                          className={clsx(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                            u.is_active ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700',
                            !isManagement && 'opacity-60 cursor-not-allowed'
                          )}
                        >
                          <span
                            className={clsx(
                                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                                u.is_active ? 'translate-x-4' : 'translate-x-1'
                            )}
                          />
                        </button>
                      </td>
                      {isManagement && (
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openEdit(u)}
                              className="text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Editar usuario"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleGenerateResetLink(u)}
                              className="text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Generar enlace de acceso"
                            >
                              <KeyRound size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={isManagement ? 6 : 5} className="px-5 py-8 text-center text-gray-400 italic">
                        No se encontraron usuarios coincidentes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
              {filtered.length} usuario(s)
            </div>
          </>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        footer={
          <>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.email}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : editUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {saveError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nombre completo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="correo@sergestiona.co"
            />
          </div>
          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="300 000 0000"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Capacidad semanal (puntos)
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={form.weekly_capacity_points}
              onChange={(e) => setForm((f) => ({ ...f, weekly_capacity_points: e.target.value }))}
              className="w-full sm:w-40 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="10 (por defecto)"
            />
            <p className="text-xs text-gray-400 mt-1">
              Vacío = usa la capacidad por defecto definida en Configuración → Parámetros.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className={clsx(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                form.is_active ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              )}
            >
              <span
                className={clsx(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                  form.is_active ? 'translate-x-4' : 'translate-x-1'
                )}
              />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">{form.is_active ? 'Usuario activo' : 'Usuario inactivo'}</span>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!resetLinkUser}
        onClose={() => setResetLinkUser(null)}
        title="Enlace de acceso"
        footer={
          <button
            onClick={() => setResetLinkUser(null)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cerrar
          </button>
        }
      >
        <div className="space-y-4">
          {resetLinkError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{resetLinkError}</span>
            </div>
          )}
          {resetLinkLoading ? (
            <p className="text-sm text-gray-500">Generando enlace...</p>
          ) : resetLinkUrl ? (
            <>
              <p className="text-sm text-gray-600">
                Comparte este enlace con <strong>{resetLinkUser?.name}</strong> por un canal seguro
                (WhatsApp, Teams, en persona). Al abrirlo podrá definir su propia contraseña nueva.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={resetLinkUrl}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                />
                <button
                  onClick={handleCopyResetLink}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                    resetLinkCopied
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  )}
                >
                  {resetLinkCopied ? <Check size={14} /> : <Copy size={14} />}
                  {resetLinkCopied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Este enlace expira en {resetLinkExpires} minutos.
              </p>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
