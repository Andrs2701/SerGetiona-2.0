'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Search, AlertCircle } from 'lucide-react';
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
  admin: 'bg-purple-100 text-purple-700',
  coordinator: 'bg-blue-100 text-blue-700',
  expert: 'bg-emerald-100 text-emerald-700',
  pedagogy: 'bg-amber-100 text-amber-700',
  design: 'bg-pink-100 text-pink-700',
  audiovisual: 'bg-orange-100 text-orange-700',
  engineering: 'bg-indigo-100 text-indigo-700',
  qa: 'bg-gray-100 text-gray-700',
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

export default function UsuariosPage() {
  const { user } = useAuthContext();
  const router = useRouter();

  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/');
      return;
    }

    api
      .get<User[]>(ENDPOINTS.USERS)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [user, router]);

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
      // revert silently — mock mode
    }
  }

  const filtered = data.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de usuarios del sistema"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Usuarios' }]}
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Nuevo Usuario
          </button>
        }
      />

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuarios..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={u.name}
                            photoUrl={u.photo_url}
                            className="w-8 h-8 bg-indigo-100 text-indigo-700 text-xs"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[u.role])}>
                          {USER_ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => toggleActive(u)}
                          className={clsx(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                            u.is_active ? 'bg-indigo-600' : 'bg-gray-200'
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
                      <td className="px-5 py-3">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nombre completo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="correo@sergestiona.co"
            />
          </div>
          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="300 000 0000"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacidad semanal (puntos)
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={form.weekly_capacity_points}
              onChange={(e) => setForm((f) => ({ ...f, weekly_capacity_points: e.target.value }))}
              className="w-full sm:w-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                form.is_active ? 'bg-indigo-600' : 'bg-gray-200'
              )}
            >
              <span
                className={clsx(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                  form.is_active ? 'translate-x-4' : 'translate-x-1'
                )}
              />
            </button>
            <span className="text-sm text-gray-700">{form.is_active ? 'Usuario activo' : 'Usuario inactivo'}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
