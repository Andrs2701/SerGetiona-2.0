'use client';

import { useState, useMemo } from 'react';
import {
  HelpCircle, BookOpen, Users, ShieldAlert, FileDown, Search, ChevronDown, ChevronUp,
  Clock, CheckCircle, AlertTriangle, ArrowRight, Video, FileText, Settings, HeartHandshake
} from 'lucide-react';
import { clsx } from 'clsx';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';

interface FAQ {
  q: string;
  a: string;
  category: string;
}

const FAQS: FAQ[] = [
  {
    category: 'Acceso',
    q: '¿Por qué me da error al intentar entrar por Wi-Fi o desde mi casa?',
    a: 'Por seguridad durante la fase piloto, el acceso está restringido. Debes estar conectado a la red cableada física dentro del campus de la universidad. El ingreso por Wi-Fi o redes externas no está permitido actualmente.'
  },
  {
    category: 'Flujo',
    q: '¿Cómo avanza el entregable al siguiente rol?',
    a: 'Una vez que completas tus tareas, registras la producción correspondiente y adjuntas el enlace de entrega en "Mi Espacio", debes cambiar el estado de tu actividad a "Entregado". El sistema activará automáticamente el turno del siguiente rol en la cadena y le enviará una notificación por correo.'
  },
  {
    category: 'Producción',
    q: '¿Qué hago si no tengo que producir nada de algún tipo de recurso en mi entregable?',
    a: 'En la sección de producción de tu actividad, cada tipo de recurso tiene un botón "N/A" (No Aplica). Al hacer clic en él, se marcará que no aplica. Si todos los recursos de tu rol no aplican, podrás entregar la actividad sin registrar cantidades.'
  },
  {
    category: 'Devoluciones',
    q: '¿Qué pasa si Calidad (QA) devuelve mi actividad?',
    a: 'Si Calidad encuentra algún hallazgo, cambiará el estado de la actividad a "Devuelta" (Ajustes Solicitados) e indicará qué rol o roles de la cadena deben realizar correcciones. Tu actividad volverá a estado activo para que realices los ajustes e ingreses tus notas en el feed interactivo.'
  }
];

const MANUAL_PRODUCCION = '/manual_produccion_sergestiona.docx';
const MANUAL_ADMIN = '/manual_administracion_sergestiona.docx';

export default function AyudaPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';
  const [activeTab, setActiveTab] = useState<'general' | 'roles' | 'faqs'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedRoleTab, setSelectedRoleTab] = useState<'operario' | 'qa' | 'gestor'>('operario');

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQS;
    return FAQS.filter(
      faq =>
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.a.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Centro de Ayuda y Manuales"
        subtitle="Encuentra guías, manuales por rol y respuestas a las preguntas más frecuentes sobre Sergestiona 2.0."
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Ayuda', href: '/ayuda' }
        ]}
        actions={
          /* Se ofrece primero el manual que le corresponde a quien abre la
             página; los gestores además tienen a mano el de producción, porque
             acompañan al equipo. */
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={isManager ? MANUAL_ADMIN : MANUAL_PRODUCCION}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-indigo-200 dark:shadow-none hover:translate-y-[-1px]"
            >
              <FileDown size={16} />
              {isManager ? 'Manual de Administración (.docx)' : 'Manual de Usuario (.docx)'}
            </a>
            {isManager && (
              <a
                href={MANUAL_PRODUCCION}
                download
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
              >
                <FileDown size={16} />
                Manual de Producción
              </a>
            )}
          </div>
        }
      />

      {/* Navigation tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={clsx(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'general'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          <BookOpen size={16} />
          Guía General
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={clsx(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'roles'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          <Users size={16} />
          Manuales por Rol
        </button>
        <button
          onClick={() => setActiveTab('faqs')}
          className={clsx(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'faqs'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          <HelpCircle size={16} />
          Preguntas Frecuentes
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Tab 1: Guía General */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <HeartHandshake className="text-indigo-600 dark:text-indigo-400" size={20} />
                  ¿Qué es Sergestiona 2.0?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Es la plataforma institucional diseñada para centralizar, transparentar y optimizar el flujo de producción de material académico de la **Universidad Sergio Arboleda**. Su propósito es sustituir el control manual de archivos por un sistema integrado y estructurado en base a roles y entregables.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                    <p className="font-semibold text-xs text-gray-800 dark:text-gray-200 mb-1">Seguimiento en Tiempo Real</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Visualiza el avance del flujo secuencial de cada entregable módulo por módulo de forma transparente.</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                    <p className="font-semibold text-xs text-gray-800 dark:text-gray-200 mb-1">Control de Tiempos</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Alertas de entregas próximas a vencer y semáforos visuales de prioridad para anticiparse a retrasos.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Instrucciones Básicas de Operación</h3>
                <div className="space-y-4">
                  {[
                    {
                      step: 1,
                      title: 'Ingresa a "Mi Espacio"',
                      desc: 'Allí encontrarás tu bandeja operativa con todas las actividades que tienes asignadas actualmente, ordenadas por prioridad y fecha de vencimiento.'
                    },
                    {
                      step: 2,
                      title: 'Registra tus avances',
                      desc: 'Cuando comiences a trabajar, selecciona la actividad para abrir el panel de detalles. Modifica el estado a "En Progreso" para notificar que la tarea está activa.'
                    },
                    {
                      step: 3,
                      title: 'Reporta producción y entrega',
                      desc: 'Una vez finalizada la actividad, ingresa las cantidades de los recursos producidos, añade el enlace de evidencia correspondiente (Sharepoint, Drive, etc.) y marca el estado como "Entregado".'
                    }
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        {step}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-5 space-y-3">
                <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm flex items-center gap-1.5">
                  <ShieldAlert size={16} />
                  Requisito de Conexión
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  Durante la fase del piloto, el acceso al servidor está restringido únicamente a la <strong>red física cableada del campus</strong> de la universidad.
                </p>
                <div className="text-[11px] text-amber-600 dark:text-amber-500">
                  <p>• No se puede acceder mediante Wi-Fi institucional.</p>
                  <p>• No se puede acceder desde redes de hogar externas sin VPN activa.</p>
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-5 space-y-3">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm flex items-center gap-1.5">
                  <Clock size={16} />
                  Flujo Secuencial
                </h4>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
                  El ciclo operativo de cada entregable es lineal y pasa obligatoriamente por los siguientes roles:
                </p>
                <div className="flex flex-col gap-1.5 text-xs text-indigo-800 dark:text-indigo-300 font-medium">
                  {['Experto Temático', 'Pedagogía', 'Diseño', 'Audiovisual', 'Engineering', 'Calidad (QA)'].map((role, idx) => (
                    <div key={role} className="flex items-center gap-2">
                      <span className="text-[10px] w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center">{idx + 1}</span>
                      <span>{role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Manuales por Rol */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            {/* Roles tabs */}
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl w-fit">
              <button
                onClick={() => setSelectedRoleTab('operario')}
                className={clsx(
                  'px-4 py-2 text-xs font-semibold rounded-lg transition-colors',
                  selectedRoleTab === 'operario'
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                )}
              >
                Flujo Operativo
              </button>
              <button
                onClick={() => setSelectedRoleTab('qa')}
                className={clsx(
                  'px-4 py-2 text-xs font-semibold rounded-lg transition-colors',
                  selectedRoleTab === 'qa'
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                )}
              >
                Calidad (QA)
              </button>
              <button
                onClick={() => setSelectedRoleTab('gestor')}
                className={clsx(
                  'px-4 py-2 text-xs font-semibold rounded-lg transition-colors',
                  selectedRoleTab === 'gestor'
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                )}
              >
                Coordinación y Gestión
              </button>
            </div>

            {/* Roles content */}
            {selectedRoleTab === 'operario' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm space-y-4">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <FileText className="text-violet-600" size={18} />
                    Expertos Temáticos y Pedagogía
                  </h4>
                  <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    <p>• <strong>Experto Temático:</strong> Primer eslabón. Recibe la solicitud de contenido del entregable. Debe cargar las lecturas, guías de estudio y rúbricas correspondientes.</p>
                    <p>• <strong>Pedagogía:</strong> Revisa el contenido del Experto, realiza el diseño instruccional, la adecuación pedagógica y define la estructura de actividades evaluativas e interactivas.</p>
                    <div className="p-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 rounded-lg text-violet-800 dark:text-violet-300 mt-2">
                      <strong>Requisito clave:</strong> Adjunta siempre el enlace de la carpeta compartida en la sección "Enlace de entrega" antes de cambiar el estado a "Entregado".
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm space-y-4">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Video className="text-amber-500" size={18} />
                    Diseño, Audiovisual e Ingeniería
                  </h4>
                  <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    <p>• <strong>Diseño:</strong> Recibe el entregable aprobado por Pedagogía. Se encarga de la maquetación visual, diseño de banners, descargables y plantillas.</p>
                    <p>• <strong>Audiovisual:</strong> Realiza la grabación, edición y postproducción de los videos instruccionales o videocápsulas requeridos en el módulo.</p>
                    <p>• <strong>Ingeniería:</strong> Es el responsable del montaje tecnológico y configuración en la plataforma de aprendizaje (LMS) institucional.</p>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg text-amber-800 dark:text-amber-300 mt-2">
                      <strong>Requisito clave:</strong> En la sección "Producción", registra las cantidades exactas producidas de cada tipo de recurso (ej. 3 videos, 1 descargable).
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedRoleTab === 'qa' && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CheckCircle className="text-emerald-600" size={20} />
                  Calidad y Certificación (QA)
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Como rol de Calidad (QA), eres el último filtro del flujo secuencial de producción. Tienes la facultad exclusiva de certificar que el entregable cumple con los estándares institucionales antes de dar por cerrada la producción académica.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1.5">Aprobación Final</p>
                    <p className="text-gray-600 dark:text-gray-400">Si el entregable está correcto, cambia su estado a "Aprobado". Esto marcará automáticamente el entregable y todas sus actividades asociadas como completadas y archivadas.</p>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-lg">
                    <p className="font-semibold text-orange-800 dark:text-orange-300 mb-1.5">Devolución y Ajustes</p>
                    <p className="text-gray-600 dark:text-gray-400">Si encuentras hallazgos, cambia el estado a "Devuelta" (Ajustes Solicitados) y selecciona cuáles roles operativos (Diseño, Pedagogía, etc.) deben realizar los ajustes antes de volver a evaluar.</p>
                  </div>
                </div>
              </div>
            )}

            {selectedRoleTab === 'gestor' && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Settings className="text-indigo-600" size={20} />
                  Administradores y Coordinadores
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Los roles de gestión tienen visibilidad global de todo el portafolio institucional, controlando la planeación temporal, el balanceo de carga y la configuración de recursos.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-lg">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Carga Masiva (Excel)</p>
                    <p className="text-gray-500 dark:text-gray-400">Permite importar cientos de entregables de forma masiva desde una plantilla de Excel parametrizando asignaturas y programas.</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-lg">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Asignación y Fechas</p>
                    <p className="text-gray-500 dark:text-gray-400">Establece quién es responsable de cada rol y fija la fecha de compromiso de entrega usando las plantillas automáticas del flujo.</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-lg">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Análisis de Capacidad</p>
                    <p className="text-gray-500 dark:text-gray-400">Monitorea la carga en puntos de cada operario para evitar sobrecargas y asegurar un reparto de trabajo equitativo.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: FAQs */}
        {activeTab === 'faqs' && (
          <div className="space-y-6">
            {/* Search FAQ */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Busca en las preguntas frecuentes..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400"
              />
            </div>

            {/* FAQ List */}
            <div className="space-y-3">
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm"
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full px-5 py-4 text-left flex justify-between items-center gap-3 font-semibold text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <span>{faq.q}</span>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 pt-1 text-xs text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-50 dark:border-gray-700/40">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-400 py-6 text-center italic">No encontramos preguntas que coincidan con tu búsqueda.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
