'use client';

import { useState, useRef } from 'react';
import { Upload, Download, X, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import Modal from '@/components/Modal';
import { downloadCsv } from '@/lib/api';

interface ImportResult {
  imported: number;
  errors: string[];
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: number;
}

function parseCSVPreview(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines
    .slice(1, 4)
    .map((line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));
  return { headers, rows };
}

export default function ImportModal({ open, onClose, projectId }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setPreview(parseCSVPreview(text));
    };
    reader.readAsText(f, 'utf-8');
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) {
      const fakeEvent = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(fakeEvent);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('sergestiona_token') : null;
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) formData.append('project_id', String(projectId));

      const res = await fetch('http://localhost:8000/api/import/deliverables', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ imported: data.imported ?? 0, errors: data.errors ?? [] });
      } else {
        setResult({ imported: 0, errors: ['Error al procesar el archivo. Verifique el formato.'] });
      }
    } catch {
      setResult({ imported: 0, errors: ['No se pudo conectar al servidor. Verifique que el backend esté activo.'] });
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setFile(null);
    setPreview(null);
    setResult(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar Entregables"
      size="lg"
      footer={
        <>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
          >
            <Upload size={14} />
            {importing ? 'Importando...' : 'Importar'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Download template */}
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div>
            <p className="text-sm font-medium text-blue-800">Plantilla CSV</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Descarga la plantilla con el formato correcto antes de importar.
            </p>
          </div>
          <button
            onClick={() => downloadCsv('/import/template', 'plantilla_entregables.csv')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={14} />
            Descargar plantilla CSV
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="text-indigo-500" size={24} />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setPreview(null);
                  setResult(null);
                }}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <Upload className="mx-auto text-gray-400 mb-2" size={28} />
              <p className="text-sm font-medium text-gray-700">Arrastra un archivo CSV aquí</p>
              <p className="text-xs text-gray-400 mt-1">o haz clic para seleccionar</p>
            </>
          )}
        </div>

        {/* CSV Preview */}
        {preview && preview.headers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Vista previa (primeras 3 filas)
            </p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[120px] truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`rounded-lg p-4 border ${result.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="text-emerald-600" size={18} />
              ) : (
                <AlertCircle className="text-amber-600" size={18} />
              )}
              <p className={`text-sm font-semibold ${result.errors.length === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                {result.imported} entregable(s) importado(s)
              </p>
            </div>
            {result.errors.length > 0 && (
              <ul className="space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-amber-700 flex items-start gap-1">
                    <span className="mt-0.5">•</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
