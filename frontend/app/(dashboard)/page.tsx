'use client';

import { useState, useEffect } from 'react';
import { FolderKanban, BookOpen, FileText, AlertCircle } from 'lucide-react';
import ProyectosTable from '@/components/ProyectosTable';
import DashboardOperativo from '@/components/DashboardOperativo';
import { StatsSkeleton } from '@/components/LoadingSkeleton';
import { api, ENDPOINTS } from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import { MOCK_DASHBOARD } from '@/lib/mock-data';
import { useAuthContext } from '@/contexts/AuthContext';

const ADMIN_ROLES = ['admin', 'coordinator'] as const;

function DashboardAdmin() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardStats>(ENDPOINTS.DASHBOARD)
      .then(setStats)
      .catch(() => setStats(MOCK_DASHBOARD))
      .finally(() => setLoading(false));
  }, []);

  const data = stats ?? MOCK_DASHBOARD;

  const statCards = [
    { label: 'Proyectos Activos', value: String(data.active_projects), icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Programas', value: String(data.total_programs), icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Entregables', value: String(data.total_deliverables), icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Con Observaciones', value: String(data.with_observations), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumen general de producción académica</p>
      </div>

      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
              <div className={`${bg} rounded-lg p-2.5`}>
                <Icon className={`${color} w-5 h-5`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Proyectos recientes</h2>
        </div>
        <ProyectosTable />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="p-6">
        <StatsSkeleton />
      </div>
    );
  }

  const isAdmin = user && ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number]);

  if (isAdmin) {
    return <DashboardAdmin />;
  }

  return <DashboardOperativo />;
}
