'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import PageHeader from '@/components/PageHeader';
import PermissionsMatrixConfig from '@/components/PermissionsMatrixConfig';
import SystemRolesConfig from '@/components/SystemRolesConfig';
import SystemStatusesConfig from '@/components/SystemStatusesConfig';
import ComplexityLevelsConfig from '@/components/ComplexityLevelsConfig';
import SystemParametersConfig from '@/components/SystemParametersConfig';
import ResourceTypesConfig from '@/components/ResourceTypesConfig';

type Tab = 'permissions' | 'roles' | 'statuses' | 'complexity' | 'parameters' | 'resource_types';

const TABS: { key: Tab; label: string }[] = [
  { key: 'permissions', label: 'Matriz de Permisos' },
  { key: 'roles', label: 'Roles' },
  { key: 'statuses', label: 'Estados' },
  { key: 'complexity', label: 'Complejidad' },
  { key: 'parameters', label: 'Parámetros' },
  { key: 'resource_types', label: 'Tipos de Recurso' },
];

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('permissions');

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Configuración"
        subtitle="Administración dinámica de permisos, roles, estados y parámetros del sistema"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Configuración' }]}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'permissions' && <PermissionsMatrixConfig />}
      {activeTab === 'roles' && <SystemRolesConfig />}
      {activeTab === 'statuses' && <SystemStatusesConfig />}
      {activeTab === 'complexity' && <ComplexityLevelsConfig />}
      {activeTab === 'parameters' && <SystemParametersConfig />}
      {activeTab === 'resource_types' && <ResourceTypesConfig />}
    </div>
  );
}
