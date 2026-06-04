'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ENDPOINTS } from '@/lib/api';
import type { User } from '@/lib/types';
import { AlertCircle, Eye, EyeOff, CheckCircle2, Mail, Lock, GraduationCap, Users, BarChart3, ClipboardList } from 'lucide-react';

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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        {!sent ? (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Recuperar contraseña</h2>
            <p className="text-sm text-gray-500 mb-5">
              Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña.
            </p>

            {error && (
              <div className="mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@sergestiona.co"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {loading ? 'Enviando...' : 'Enviar instrucciones'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-full mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">¡Correo enviado!</h2>
            <p className="text-sm text-gray-500 mb-5">
              Si existe una cuenta con ese correo, recibirás las instrucciones en los próximos minutos.
            </p>
            <button
              onClick={onClose}
              className="py-2 px-6 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
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
      const response = await api.post<{ access_token: string; user: User }>(
        ENDPOINTS.LOGIN,
        { email, password }
      );
      localStorage.setItem('sergestiona_token', response.access_token);
      localStorage.setItem('sergestiona_user', JSON.stringify(response.user));
      if (remember) {
        localStorage.setItem('sergestiona_remember', 'true');
      }
      router.push('/');
    } catch {
      setError('Correo o contraseña incorrectos. Por favor verifica tus datos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {showRecovery && <PasswordRecoveryModal onClose={() => setShowRecovery(false)} />}

      <div className="min-h-screen flex">
        {/* Left panel — branding (hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-800 to-indigo-600 flex-col justify-between p-12">
          <div>
            <div className="flex items-center gap-2 mb-12">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-xl tracking-tight">Sergestiona</span>
                <span className="text-indigo-300 text-sm ml-1">2.0</span>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Plataforma de Gestión de Producción Académica
            </h1>
            <p className="text-indigo-200 text-lg leading-relaxed">
              Centraliza, controla y mide el avance de todos tus proyectos académicos en un solo lugar.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: ClipboardList, text: 'Trazabilidad completa de entregables y roles' },
              { icon: Users, text: 'Colaboración en tiempo real entre equipos' },
              { icon: BarChart3, text: 'Indicadores automáticos de cumplimiento' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-indigo-100" />
                </div>
                <span className="text-indigo-100 text-sm">{text}</span>
              </div>
            ))}
          </div>

          <p className="text-indigo-300 text-xs">
            Sergestiona 2.0 &copy; {new Date().getFullYear()}
          </p>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex items-center justify-center p-6 bg-white">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center gap-1 mb-1">
                <span className="font-bold text-2xl text-indigo-700 tracking-tight">Sergestiona</span>
                <span className="text-sm font-medium text-gray-400 mt-0.5">2.0</span>
              </div>
              <p className="text-sm text-gray-500">Plataforma de Gestión Académica</p>
            </div>

            {/* Desktop logo text */}
            <div className="hidden lg:block mb-8">
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-2">
                Sergestiona 2.0
              </p>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">Iniciar Sesión</h2>
            <p className="text-sm text-gray-500 mb-8">Ingresa tus credenciales para continuar</p>

            {error && (
              <div className="mb-5 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@sergestiona.co"
                    required
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember + forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-600">Recordar sesión</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowRecovery(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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

            <p className="text-center text-xs text-gray-400 mt-8">
              Sergestiona 2.0 &copy; {new Date().getFullYear()} · Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
