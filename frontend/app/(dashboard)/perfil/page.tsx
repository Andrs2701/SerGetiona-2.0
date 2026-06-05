'use client';

import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, CheckCircle2, AlertCircle,
  Mail, Phone, Shield, CheckCheck, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthContext } from '@/contexts/AuthContext';
import { api, ENDPOINTS } from '@/lib/api';
import { USER_ROLE_LABELS } from '@/lib/types';
import type { WorkspaceStats } from '@/lib/types';
import { Skeleton } from '@/components/LoadingSkeleton';

function getStrength(pwd: string): { label: string; color: string; width: string } {
  if (pwd.length === 0) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 2) return { label: 'Débil', color: 'bg-red-400', width: '33%' };
  if (score <= 3) return { label: 'Media', color: 'bg-amber-400', width: '66%' };
  return { label: 'Fuerte', color: 'bg-emerald-500', width: '100%' };
}

export default function PerfilPage() {
  const { user, changePassword } = useAuthContext();
  const [current, setCurrent] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ stats: WorkspaceStats }>(ENDPOINTS.MY_WORKSPACE)
      .then((res) => {
        const data = res as unknown as { stats: WorkspaceStats };
        if (data?.stats) setStats(data.stats);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const strength = getStrength(newPwd);

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || 'US'
    : 'US';

  const total = stats ? stats.completed + stats.overdue + stats.approaching + stats.pending : 0;
  const compliance = total > 0 && stats ? Math.round((stats.completed / total) * 100) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPwd !== confirm) {
      setError('La nueva contraseña y la confirmación no coinciden.');
      return;
    }
    if (newPwd.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(current, newPwd, confirm);
      setSuccess(true);
      setCurrent('');
      setNewPwd('');
      setConfirm('');
    } catch {
      setError('No se pudo actualizar la contraseña. Verifica que la contraseña actual sea correcta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestiona tu información personal y seguridad</p>
      </div>

      {/* User card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{user?.name ?? '—'}</h2>
            <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {user ? USER_ROLE_LABELS[user.role] : '—'}
            </span>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={14} className="text-gray-400 flex-shrink-0" />
                <span>{user?.email ?? '—'}</span>
              </div>
              {user?.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Shield size={14} className="text-gray-400 flex-shrink-0" />
                <span>Cuenta activa</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500" />
          Mis Estadísticas
        </h2>
        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <CheckCheck size={18} className="text-emerald-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-700">{stats.completed}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Completadas</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <AlertTriangle size={18} className="text-red-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-600">{stats.overdue}</p>
                <p className="text-xs text-red-500 mt-0.5">Vencidas</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <AlertCircle size={18} className="text-amber-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-amber-600">{stats.approaching}</p>
                <p className="text-xs text-amber-500 mt-0.5">Por vencer</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <Shield size={18} className="text-gray-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-gray-700">{stats.pending}</p>
                <p className="text-xs text-gray-500 mt-0.5">Pendientes</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 font-medium">% Cumplimiento personal</span>
                <span className={clsx(
                  'text-sm font-bold',
                  compliance >= 80 ? 'text-emerald-600' : compliance >= 50 ? 'text-amber-600' : 'text-red-500'
                )}>{compliance}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    compliance >= 80 ? 'bg-emerald-500' : compliance >= 50 ? 'bg-amber-400' : 'bg-red-400'
                  )}
                  style={{ width: `${compliance}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No disponible para tu rol</p>
        )}
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Shield size={16} className="text-indigo-500" />
          Cambiar contraseña
        </h2>

        {success && (
          <div className="mb-5 flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
            <span>¡Contraseña actualizada exitosamente!</span>
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña actual</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {newPwd.length > 0 && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={clsx('h-full rounded-full transition-all', strength.color)}
                    style={{ width: strength.width }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Fortaleza: <span className="font-medium text-gray-700">{strength.label}</span>
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar nueva contraseña</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                className={clsx(
                  'w-full px-3 py-2 pr-10 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500',
                  confirm.length > 0 && confirm !== newPwd ? 'border-red-300' : 'border-gray-200'
                )}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirm.length > 0 && confirm !== newPwd && (
              <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 mt-2"
          >
            {loading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
