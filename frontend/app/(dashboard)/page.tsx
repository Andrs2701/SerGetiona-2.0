import { FolderKanban, BookOpen, FileText, AlertCircle } from "lucide-react";
import ProyectosTable from "@/components/ProyectosTable";

const stats = [
  { label: "Proyectos Activos", value: "4", icon: FolderKanban, color: "text-indigo-600", bg: "bg-indigo-50" },
  { label: "Programas", value: "12", icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "Entregables", value: "247", icon: FileText, color: "text-amber-600", bg: "bg-amber-50" },
  { label: "Con Observaciones", value: "18", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
];

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumen general de producción académica</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
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

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Proyectos</h2>
          <button className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-colors">
            + Nuevo Proyecto
          </button>
        </div>
        <ProyectosTable />
      </div>
    </div>
  );
}
