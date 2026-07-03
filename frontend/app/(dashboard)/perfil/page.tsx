'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Eye, EyeOff, CheckCircle2, AlertCircle,
  Mail, Phone, Shield, CheckCheck, AlertTriangle, TrendingUp,
  Camera, User, Briefcase, MapPin, Save, Sun, Moon, Monitor,
  Bell, ClipboardList, MessagesSquare,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { api, ENDPOINTS } from '@/lib/api';
import { USER_ROLE_LABELS } from '@/lib/types';
import type { WorkspaceStats, User as UserAccount, UserPreferences } from '@/lib/types';
import { Skeleton } from '@/components/LoadingSkeleton';
import Avatar from '@/components/Avatar';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function parseApiError(err: unknown): string {
  if (!(err instanceof Error)) return 'No se pudo subir la foto. Intenta de nuevo.';
  const body = err.message.replace(/^HTTP \d+:\s*/, '');
  try {
    const parsed = JSON.parse(body) as { message?: string; errors?: Record<string, string[]> };
    const firstFieldError = parsed.errors && Object.values(parsed.errors)[0]?.[0];
    return firstFieldError ?? parsed.message ?? body;
  } catch {
    return body || 'No se pudo subir la foto. Intenta de nuevo.';
  }
}
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

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  coordinator:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  expert:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pedagogy:     'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  design:       'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  audiovisual:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  engineering:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  qa:           'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];

function getMockHistory(): number[] {
  return [72, 85, 68, 90, 78, 88];
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function PerfilPage() {
  const { user, changePassword, updateUser } = useAuthContext();
  const { theme, setTheme } = useTheme();

  // ── Avatar / photo ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // ── Personal data form ──
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // ── Password ──
  const [current, setCurrent] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // ── Stats ──
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Email notification preferences ──
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setFullName(user.name ?? '');
      setPhone(user.phone ?? '');
      setPosition(user.position ?? '');
      setDepartment(user.department ?? '');
    }
  }, [user]);

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

  useEffect(() => {
    api
      .get<{ preferences: UserPreferences }>(ENDPOINTS.PREFERENCES)
      .then((res) => setPrefs(res.preferences ?? {}))
      .catch(() => setPrefs({}))
      .finally(() => setPrefsLoading(false));
  }, []);

  function togglePref(key: keyof UserPreferences) {
    if (!prefs) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    api.put(ENDPOINTS.PREFERENCES, { [key]: next[key] }).catch(() => setPrefs(previous));
  }

  const strength = getStrength(newPwd);

  const total = stats ? stats.completed + stats.overdue + stats.approaching + stats.pending : 0;
  const compliance = total > 0 && stats ? Math.round((stats.completed / total) * 100) : 0;
  const history = getMockHistory();
  const maxBar = Math.max(...history, 1);

  const currentMonth = new Date().getMonth();
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const idx = (currentMonth - 5 + i + 12) % 12;
    return MONTH_LABELS[idx] ?? MONTH_LABELS[i] ?? '';
  });

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('photo', file);
    setUploadingPhoto(true);
    try {
      const updated = await api.postForm<UserAccount>(ENDPOINTS.PROFILE_PHOTO, formData);
      updateUser(updated);
      setPhotoPreview(null); // Limpiar preview local al tener éxito para validar visualmente la URL del servidor
    } catch (err) {
      setPhotoError(parseApiError(err));
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setProfileError('');
    setProfileSuccess(false);
    setSavingProfile(true);
    try {
      const updated = await api.put<UserAccount>(ENDPOINTS.PROFILE, { name: fullName, position, phone, department });
      updateUser(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      setProfileError('No se pudieron guardar los cambios. Intenta de nuevo.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPwd !== confirm) { setError('La nueva contraseña y la confirmación no coinciden.'); return; }
    if (newPwd.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      await changePassword(current, newPwd, confirm);
      setSuccess(true);
      setCurrent(''); setNewPwd(''); setConfirm('');
    } catch {
      setError('No se pudo actualizar la contraseña. Verifica que la contraseña actual sea correcta.');
    } finally {
      setLoading(false);
    }
  }

  const themeOptions: { value: Theme; label: string; desc: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { value: 'light',  label: 'Claro',   desc: 'Fondo blanco, texto oscuro',    Icon: Sun },
    { value: 'dark',   label: 'Oscuro',  desc: 'Fondo oscuro, texto claro',     Icon: Moon },
    { value: 'system', label: 'Sistema', desc: 'Sigue la preferencia del SO',   Icon: Monitor },
  ];

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
  const cardCls  = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700';

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gestiona tu información personal y seguridad</p>
      </div>

      {/* ── 2-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT — avatar + personal data form */}
        <div className="space-y-6">

          {/* Avatar card */}
          <div className={`${cardCls} p-4 sm:p-6`}>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar
                  name={user?.name ?? 'Usuario'}
                  photoUrl={photoPreview ?? user?.photo_url}
                  className="w-20 h-20 text-2xl text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, #194276 0%, #4f46e5 100%)' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:shadow-md transition-all disabled:opacity-60"
                >
                  <Camera size={13} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
              {photoError && (
                <p className="text-xs text-red-500 dark:text-red-400 -mt-2">{photoError}</p>
              )}

              <div className="text-center">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{user?.name ?? '—'}</h2>
                <span className={clsx(
                  'inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  ROLE_BADGE_COLORS[user?.role ?? 'admin'] ?? 'bg-gray-100 text-gray-600'
                )}>
                  {user ? USER_ROLE_LABELS[user.role] : '—'}
                </span>
              </div>

              <div className="w-full space-y-2 border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Mail size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span className="truncate">{user?.email ?? '—'}</span>
                </div>
                {user?.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Phone size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span>{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Shield size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span>Cuenta activa</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Personal data form */}
          <div className={`${cardCls} p-5`}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <User size={16} className="text-indigo-500" />
              Datos Personales
            </h2>

            {profileSuccess && (
              <div className="mb-4 flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-3">
                <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
                <span>¡Cambios guardados exitosamente!</span>
              </div>
            )}
            {profileError && (
              <div className="mb-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-3">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className={labelCls}>Nombre completo</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre completo"
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Cargo</label>
                <div className="relative">
                  <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Ej. Coordinador de contenidos"
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Correo electrónico <span className="text-gray-400 font-normal text-xs">(no editable)</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={user?.email ?? ''}
                    readOnly
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Teléfono</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+57 300 000 0000"
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Área / Departamento</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ej. Producción académica"
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
                style={{ background: '#194276' }}
              >
                <Save size={14} />
                {savingProfile ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT — apariencia + stats + history + flow + password */}
        <div className="space-y-6">

          {/* Apariencia */}
          <div className={`${cardCls} p-5`}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <Sun size={16} className="text-indigo-500" />
              Apariencia
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Elige cómo se ve la plataforma</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themeOptions.map(({ value, label, desc, Icon }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={clsx(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center',
                      active
                        ? 'border-[#194276] bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    )}
                  >
                    <div className={clsx(
                      'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                      active
                        ? 'text-white'
                        : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
                    )}
                      style={active ? { background: '#194276' } : undefined}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className={clsx(
                        'text-xs font-semibold',
                        active ? 'text-[#194276] dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                      )}>{label}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notificaciones por correo */}
          <div className={`${cardCls} p-5`}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <Bell size={16} className="text-indigo-500" />
              Notificaciones por correo
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Elige qué eventos quieres recibir también por correo electrónico</p>

            {prefsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Activar notificaciones por correo</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Interruptor general — apágalo para no recibir ningún correo</p>
                  </div>
                  <button
                    onClick={() => togglePref('email_notifications_enabled')}
                    className={clsx(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
                      prefs?.email_notifications_enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                    )}
                  >
                    <span className={clsx(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                      prefs?.email_notifications_enabled ? 'translate-x-4' : 'translate-x-1'
                    )} />
                  </button>
                </div>

                {([
                  { key: 'email_tasks' as const, icon: <ClipboardList size={15} />, label: 'Tareas', desc: 'Asignaciones, cambios de estado, ajustes solicitados' },
                  { key: 'email_chat' as const, icon: <MessagesSquare size={15} />, label: 'Chat', desc: 'Menciones, comentarios, canales' },
                  { key: 'email_deadlines' as const, icon: <AlertTriangle size={15} />, label: 'Vencimientos', desc: 'Próximas a vencer y vencidas' },
                ]).map(({ key, icon, label, desc }) => {
                  const disabled = !prefs?.email_notifications_enabled;
                  return (
                    <div key={key} className={clsx('flex items-center justify-between py-2', disabled && 'opacity-40')}>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{label}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => !disabled && togglePref(key)}
                        disabled={disabled}
                        className={clsx(
                          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 disabled:cursor-not-allowed',
                          prefs?.[key] ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                        )}
                      >
                        <span className={clsx(
                          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                          prefs?.[key] ? 'translate-x-4' : 'translate-x-1'
                        )} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className={`${cardCls} p-5`}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-500" />
              Mis Estadísticas
            </h2>
            {statsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                    <CheckCheck size={18} className="text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{stats.completed}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Completadas</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                    <AlertTriangle size={18} className="text-red-500 dark:text-red-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</p>
                    <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">Vencidas</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                    <AlertCircle size={18} className="text-amber-500 dark:text-amber-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.approaching}</p>
                    <p className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">Por vencer</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <Shield size={18} className="text-gray-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{stats.pending}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pendientes</p>
                  </div>
                </div>

                {/* Compliance bar */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">% Cumplimiento personal</span>
                    <span className={clsx(
                      'text-sm font-bold',
                      compliance >= 80 ? 'text-emerald-600 dark:text-emerald-400'
                        : compliance >= 50 ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-500 dark:text-red-400'
                    )}>{compliance}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        compliance >= 80 ? 'bg-emerald-500' : compliance >= 50 ? 'bg-amber-400' : 'bg-red-400'
                      )}
                      style={{ width: `${compliance}%` }}
                    />
                  </div>
                </div>

                {/* Compliance history */}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Historial de cumplimiento (últimos 6 meses)</p>
                  <div className="flex items-end gap-2 h-16">
                    {history.map((val, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={clsx(
                            'w-full rounded-t transition-all',
                            val >= 80 ? 'bg-emerald-400' : val >= 60 ? 'bg-amber-400' : 'bg-red-400'
                          )}
                          style={{ height: `${(val / maxBar) * 52}px` }}
                          title={`${val}%`}
                        />
                        <span className="text-[9px] text-gray-400 dark:text-gray-500">{monthLabels[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No disponible para tu rol</p>
            )}
          </div>

          {/* Role in flow */}
          {user && !['admin', 'coordinator'].includes(user.role) && (
            <div className={`${cardCls} p-5`}>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-500" />
                Rol en el flujo de producción
              </h2>
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {(['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'] as const).map((r, i, arr) => {
                  const isMe = user.role === r;
                  return (
                    <div key={r} className="flex items-center gap-1 flex-shrink-0">
                      <div
                        className={clsx(
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                          isMe ? 'text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        )}
                        style={isMe ? { background: '#194276' } : undefined}
                      >
                        <span className="text-[10px] font-bold opacity-60">{i + 1}.</span>
                        {USER_ROLE_LABELS[r]}
                      </div>
                      {i < arr.length - 1 && (
                        <span className="text-gray-300 dark:text-gray-600 text-xs">›</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                Tu etapa es <span className="font-medium text-gray-600 dark:text-gray-300">{USER_ROLE_LABELS[user.role]}</span>{' '}
                (paso {(['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'] as const).indexOf(user.role as 'expert' | 'pedagogy' | 'design' | 'audiovisual' | 'engineering' | 'qa') + 1} de 6).
              </p>
            </div>
          )}

          {/* Change password */}
          <div className={`${cardCls} p-5`}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
              <Shield size={16} className="text-indigo-500" />
              Cambiar contraseña
            </h2>

            {success && (
              <div className="mb-5 flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-3">
                <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
                <span>¡Contraseña actualizada exitosamente!</span>
              </div>
            )}
            {error && (
              <div className="mb-5 flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-3">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Contraseña actual</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {newPwd.length > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={clsx('h-full rounded-full transition-all', strength.color)} style={{ width: strength.width }} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Fortaleza: <span className="font-medium text-gray-700 dark:text-gray-300">{strength.label}</span>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Confirmar nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={clsx(
                      inputCls,
                      'pr-10',
                      confirm.length > 0 && confirm !== newPwd ? 'border-red-300 dark:border-red-600' : ''
                    )}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {confirm.length > 0 && confirm !== newPwd && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">Las contraseñas no coinciden.</p>
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
      </div>
    </div>
  );
}
