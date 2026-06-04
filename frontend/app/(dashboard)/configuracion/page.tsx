'use client';

import { useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import { clsx } from 'clsx';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';

type Role = 'expert' | 'pedagogy' | 'design' | 'audiovisual' | 'engineering' | 'qa';

const ROLES: Role[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

const ROLE_LABELS: Record<Role, string> = {
  expert: 'Experto',
  pedagogy: 'Pedagogía',
  design: 'Diseño',
  audiovisual: 'Audiovisual',
  engineering: 'Ingeniería',
  qa: 'Calidad',
};

interface FlowTemplate {
  id: number;
  name: string;
  is_default: boolean;
  offsets: Record<Role, number>;
}

const MOCK_TEMPLATES: FlowTemplate[] = [
  {
    id: 1,
    name: 'Flujo Estándar Creación',
    is_default: true,
    offsets: { expert: 0, pedagogy: 5, design: 10, audiovisual: 15, engineering: 20, qa: 25 },
  },
  {
    id: 2,
    name: 'Flujo Rápido Actualización',
    is_default: false,
    offsets: { expert: 0, pedagogy: 3, design: 6, audiovisual: 9, engineering: 12, qa: 14 },
  },
  {
    id: 3,
    name: 'Flujo Complejo Multimedia',
    is_default: false,
    offsets: { expert: 0, pedagogy: 7, design: 14, audiovisual: 21, engineering: 28, qa: 35 },
  },
];

const GLOBAL_STATUS_INFO = [
  { key: 'unpublished', label: 'Sin Publicar', color: 'bg-gray-200', description: 'El entregable aún no ha sido publicado.' },
  { key: 'pending_start', label: 'Pendiente Inicio', color: 'bg-amber-400', description: 'Listo para comenzar producción.' },
  { key: 'in_progress', label: 'En Ejecución', color: 'bg-blue-500', description: 'En proceso de producción.' },
  { key: 'in_review', label: 'En Revisión', color: 'bg-purple-500', description: 'En proceso de revisión de calidad.' },
  { key: 'with_observations', label: 'Con Observaciones', color: 'bg-orange-500', description: 'Requiere correcciones.' },
  { key: 'finished', label: 'Finalizado', color: 'bg-emerald-500', description: 'Aprobado y publicado.' },
  { key: 'cancelled', label: 'Cancelado', color: 'bg-red-500', description: 'Cancelado sin producción.' },
  { key: 'not_applicable', label: 'No Aplica', color: 'bg-gray-100', description: 'No aplica para este entregable.' },
];

const ROLE_STATUS_INFO = [
  { key: 'not_started', label: 'Sin Iniciar', color: 'bg-gray-200' },
  { key: 'pending', label: 'Pendiente', color: 'bg-gray-300' },
  { key: 'in_progress', label: 'En Progreso', color: 'bg-blue-400' },
  { key: 'in_review', label: 'En Revisión', color: 'bg-purple-400' },
  { key: 'approved', label: 'Aprobado', color: 'bg-emerald-500' },
  { key: 'with_observations', label: 'Con Obs.', color: 'bg-orange-400' },
  { key: 'not_applicable', label: 'No Aplica', color: 'bg-gray-100' },
];

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<'flows' | 'statuses' | 'roles'>('flows');
  const [templates, setTemplates] = useState<FlowTemplate[]>(MOCK_TEMPLATES);
  const [editTemplate, setEditTemplate] = useState<FlowTemplate | null>(null);
  const [editOffsets, setEditOffsets] = useState<Record<Role, number>>({} as Record<Role, number>);

  function openEdit(t: FlowTemplate) {
    setEditTemplate(t);
    setEditOffsets({ ...t.offsets });
  }

  function handleSave() {
    if (!editTemplate) return;
    setTemplates((prev) =>
      prev.map((t) => (t.id === editTemplate.id ? { ...t, offsets: editOffsets } : t))
    );
    setEditTemplate(null);
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Configuración"
        subtitle="Configuración de flujos, estados y roles del sistema"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Configuración' }]}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(['flows', 'statuses', 'roles'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab === 'flows' ? 'Flujos de Producción' : tab === 'statuses' ? 'Estados' : 'Roles'}
          </button>
        ))}
      </div>

      {/* Tab: Flujos */}
      {activeTab === 'flows' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Los flujos de producción definen los días de offset para cada rol desde el inicio de un entregable.
          </p>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  {ROLES.map((r) => (
                    <th key={r} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{t.name}</span>
                        {t.is_default && (
                          <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">
                            Por defecto
                          </span>
                        )}
                      </div>
                    </td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-3 py-3 text-center text-gray-600">
                        +{t.offsets[r]}d
                      </td>
                    ))}
                    <td className="px-5 py-3">
                      <button
                        onClick={() => openEdit(t)}
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
        </div>
      )}

      {/* Tab: Estados */}
      {activeTab === 'statuses' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Estados Globales de Entregable</h3>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
              {GLOBAL_STATUS_INFO.map((s) => (
                <div key={s.key} className="px-4 py-3 flex items-center gap-3">
                  <div className={clsx('w-3 h-3 rounded-full flex-shrink-0', s.color)} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{s.label}</p>
                    <p className="text-xs text-gray-500">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Estados por Rol</h3>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
              {ROLE_STATUS_INFO.map((s) => (
                <div key={s.key} className="px-4 py-3 flex items-center gap-3">
                  <div className={clsx('w-3 h-3 rounded-full flex-shrink-0', s.color)} />
                  <p className="text-sm font-medium text-gray-900">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Roles */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {ROLES.map((r) => (
            <div key={r} className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{ROLE_LABELS[r]}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r === 'expert' && 'Responsable del contenido académico y disciplinar.'}
                  {r === 'pedagogy' && 'Responsable del diseño instruccional y pedagógico.'}
                  {r === 'design' && 'Responsable del diseño gráfico y visual.'}
                  {r === 'audiovisual' && 'Responsable de la producción audiovisual.'}
                  {r === 'engineering' && 'Responsable de la integración y publicación técnica.'}
                  {r === 'qa' && 'Responsable del control de calidad final.'}
                </p>
              </div>
              <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <Check size={12} />
                Activo
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Edit template modal */}
      <Modal
        open={!!editTemplate}
        onClose={() => setEditTemplate(null)}
        title={`Editar: ${editTemplate?.name ?? ''}`}
        footer={
          <>
            <button
              onClick={() => setEditTemplate(null)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Guardar Cambios
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Define los días de offset desde el inicio del entregable para cada rol.
          </p>
          {ROLES.map((r) => (
            <div key={r} className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{ROLE_LABELS[r]}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={editOffsets[r] ?? 0}
                  onChange={(e) =>
                    setEditOffsets((prev) => ({ ...prev, [r]: Number(e.target.value) }))
                  }
                  className="w-20 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                />
                <span className="text-sm text-gray-500">días</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
