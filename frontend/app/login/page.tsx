'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api, ENDPOINTS } from '@/lib/api';
import type { User } from '@/lib/types';
import { BASE_PATH } from '@/lib/basePath';
import { AlertCircle, Eye, EyeOff, CheckCircle2, Mail, Lock, GraduationCap, Users, BarChart3, ClipboardList } from 'lucide-react';

// Colores institucionales Universidad Sergio Arboleda
// Azul oscuro: #194276  |  Amarillo: #ffec00

function PasswordRecoveryModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post(ENDPOINTS.FORGOT_PASSWORD, { email });
      setSent(true);
    } catch {
      setError('No pudimos procesar tu solicitud. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#0d2a4f] rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-transparent dark:border-gray-700">
        {!sent ? (
          <>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Recuperar contraseña</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña.
            </p>

            {error && (
              <div className="mb-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@usa.edu.co"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 dark:bg-[#0a1929] dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none focus:border-transparent transition-shadow"
                  onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(25,66,118,0.2)')}
                  onBlur={e => (e.currentTarget.style.boxShadow = '')}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60"
                  style={{ background: '#194276' }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.background = '#12305a')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#194276')}
                >
                  {loading ? 'Enviando...' : 'Enviar instrucciones'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="flex items-center justify-center w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">¡Correo enviado!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Si existe una cuenta con ese correo, recibirás las instrucciones en los próximos minutos.
            </p>
            <button
              onClick={onClose}
              className="py-2 px-6 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ background: '#194276' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#12305a')}
              onMouseLeave={e => (e.currentTarget.style.background = '#194276')}
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post<{ token: string; user: User }>(
        ENDPOINTS.LOGIN,
        { email, password }
      );
      localStorage.setItem('sergestiona_token', response.token);
      localStorage.setItem('sergestiona_user', JSON.stringify(response.user));
      if (remember) localStorage.setItem('sergestiona_remember', 'true');
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.startsWith('HTTP 401') || message.startsWith('HTTP 422')) {
        setError('Correo o contraseña incorrectos. Por favor verifica tus datos.');
      } else if (message) {
        setError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
      } else {
        setError('Ocurrió un error inesperado. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {showRecovery && <PasswordRecoveryModal onClose={() => setShowRecovery(false)} />}

      <div className="min-h-screen flex dark:bg-[#0a1929]">

        {/* ── Panel izquierdo — branding institucional (oculto en móvil) ── */}
        <div
          className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #0d2a4f 0%, #194276 55%, #1e5099 100%)' }}
        >
          {/* Decoraciones de fondo */}
          <div className="absolute inset-0 pointer-events-none select-none">
            <div
              className="absolute -top-24 -right-24 w-96 h-96 rounded-full"
              style={{ background: '#ffec00', opacity: 0.07 }}
            />
            <div
              className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full"
              style={{ background: '#ffec00', opacity: 0.07 }}
            />
            <div
              className="absolute top-0 left-0 w-1 h-full"
              style={{ background: 'linear-gradient(to bottom, transparent 0%, #ffec00 50%, transparent 100%)', opacity: 0.25 }}
            />
          </div>

          {/* Logo + nombre */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,236,0,0.15)', border: '1.5px solid rgba(255,236,0,0.3)' }}
              >
                <GraduationCap className="w-7 h-7" style={{ color: '#ffec00' }} />
              </div>
              <div>
                <div className="font-bold text-white text-xl tracking-tight leading-tight">Sergestiona</div>
                <div
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: '#ffec00' }}
                >
                  v2.0
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Plataforma de Gestión de Producción Académica
            </h1>
            <p className="text-blue-200 text-lg leading-relaxed">
              Centraliza, controla y mide el avance de todos tus proyectos académicos en un solo lugar.
            </p>
          </div>

          {/* Características */}
          <div className="relative z-10 space-y-4">
            {[
              { icon: ClipboardList, text: 'Trazabilidad completa de entregables y roles' },
              { icon: Users,         text: 'Colaboración en tiempo real entre equipos' },
              { icon: BarChart3,     text: 'Indicadores automáticos de cumplimiento' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,236,0,0.1)', border: '1px solid rgba(255,236,0,0.2)' }}
                >
                  <Icon className="w-5 h-5" style={{ color: '#ffec00' }} />
                </div>
                <span className="text-blue-100 text-sm">{text}</span>
              </div>
            ))}
          </div>

          {/* Pie del panel */}
          <div className="relative z-10">
            <div className="w-10 h-0.5 mb-4 rounded-full" style={{ background: '#ffec00', opacity: 0.45 }} />
            <p className="text-blue-300 text-xs">
              Universidad Sergio Arboleda &nbsp;·&nbsp; Sergestiona 2.0 &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>

        {/* ── Panel derecho — formulario ── */}
        <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-[#0d2a4f]">
          <div className="w-full max-w-sm">

            {/* Logo institucional — light: logo-usa.png / dark: logo-usa_black.png */}
            <div className="flex justify-center mb-8">
              {/* Modo claro */}
              <Image
                src={`${BASE_PATH}/logo-usa.png`}
                alt="Campus Virtual — Universidad Sergio Arboleda"
                width={260}
                height={72}
                priority
                className="object-contain dark:hidden"
                style={{ maxHeight: 72, width: 'auto', height: 'auto' }}
              />
              {/* Modo oscuro */}
              <Image
                src={`${BASE_PATH}/logo-usa_black.png`}
                alt="Campus Virtual — Universidad Sergio Arboleda"
                width={260}
                height={72}
                priority
                className="object-contain hidden dark:block"
                style={{ maxHeight: 72, width: 'auto', height: 'auto' }}
              />
            </div>

            {/* Separador con badge de sistema */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full text-[#194276] dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30">
                Sergestiona 2.0
              </span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Iniciar Sesión</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Ingresa tus credenciales institucionales para continuar</p>

            {error && (
              <div className="mb-5 flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@usa.edu.co"
                    required
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 dark:bg-[#0a1929] dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none focus:border-transparent transition-shadow"
                    onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(25,66,118,0.25)')}
                    onBlur={e => (e.currentTarget.style.boxShadow = '')}
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 dark:border-gray-600 dark:bg-[#0a1929] dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none focus:border-transparent transition-shadow"
                    onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(25,66,118,0.25)')}
                    onBlur={e => (e.currentTarget.style.boxShadow = '')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Recordar + olvidé */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 border-gray-300 rounded"
                    style={{ accentColor: '#194276' }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Recordar sesión</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowRecovery(true)}
                  className="text-sm font-medium hover:underline transition-colors text-[#194276] dark:text-blue-400"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Botón principal */}
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-2.5 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none"
                style={{ background: '#194276' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#12305a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#194276'; }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Iniciando sesión...
                  </span>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </form>

            {/* Separador con acento amarillo */}
            <div className="flex items-center gap-2 mt-8 mb-4">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
              <div className="w-2 h-2 rounded-full" style={{ background: '#ffec00' }} />
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
            </div>

            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              Sergestiona 2.0 &copy; {new Date().getFullYear()} &nbsp;·&nbsp; Universidad Sergio Arboleda
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
