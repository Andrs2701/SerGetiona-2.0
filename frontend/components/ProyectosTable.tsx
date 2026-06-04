"use client";

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { clsx } from "clsx";

type Proyecto = {
  id: number;
  nombre: string;
  estado: string;
  programas: number;
  entregables: number;
  cumplimiento: number;
  responsable: string;
  fechaInicio: string;
};

const estadoColors: Record<string, string> = {
  "En Ejecución": "bg-emerald-100 text-emerald-700",
  "Parametrizado": "bg-blue-100 text-blue-700",
  "Pendiente Parametrización": "bg-amber-100 text-amber-700",
  "Borrador": "bg-gray-100 text-gray-600",
  "Suspendido": "bg-red-100 text-red-700",
  "Finalizado": "bg-gray-100 text-gray-500",
};

const PROYECTOS_DEMO: Proyecto[] = [
  {
    id: 1,
    nombre: "Actualización Curricular 2026",
    estado: "En Ejecución",
    programas: 8,
    entregables: 142,
    cumplimiento: 67,
    responsable: "Ana Rodríguez",
    fechaInicio: "2026-01-15",
  },
  {
    id: 2,
    nombre: "Creación Especialización Psicosocial",
    estado: "Parametrizado",
    programas: 1,
    entregables: 48,
    cumplimiento: 23,
    responsable: "Carlos Méndez",
    fechaInicio: "2026-02-01",
  },
  {
    id: 3,
    nombre: "Control de Cambios Q1 2026",
    estado: "En Ejecución",
    programas: 3,
    entregables: 37,
    cumplimiento: 89,
    responsable: "Laura Torres",
    fechaInicio: "2026-01-05",
  },
  {
    id: 4,
    nombre: "Ajuste Contenidos Maestría",
    estado: "Pendiente Parametrización",
    programas: 2,
    entregables: 20,
    cumplimiento: 0,
    responsable: "Jhon Pérez",
    fechaInicio: "2026-03-10",
  },
];

const col = createColumnHelper<Proyecto>();

const columns = [
  col.accessor("nombre", {
    header: "Proyecto",
    cell: (info) => (
      <span className="font-medium text-gray-900">{info.getValue()}</span>
    ),
  }),
  col.accessor("estado", {
    header: "Estado",
    cell: (info) => (
      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", estadoColors[info.getValue()] ?? "bg-gray-100 text-gray-600")}>
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor("programas", {
    header: "Programas",
    cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
  }),
  col.accessor("entregables", {
    header: "Entregables",
    cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
  }),
  col.accessor("cumplimiento", {
    header: "Cumplimiento",
    cell: (info) => {
      const v = info.getValue();
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
            <div
              className={clsx("h-full rounded-full", v >= 80 ? "bg-emerald-500" : v >= 50 ? "bg-amber-400" : "bg-red-400")}
              style={{ width: `${v}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-8">{v}%</span>
        </div>
      );
    },
  }),
  col.accessor("responsable", {
    header: "Responsable",
    cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
  }),
  col.accessor("fechaInicio", {
    header: "Fecha Inicio",
    cell: (info) => <span className="text-gray-500 text-sm">{info.getValue()}</span>,
  }),
];

export default function ProyectosTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data: PROYECTOS_DEMO,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar proyectos..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-100 bg-gray-50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
        {table.getRowModel().rows.length} proyecto(s)
      </div>
    </div>
  );
}
