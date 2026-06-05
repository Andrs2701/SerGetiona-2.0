'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Trash2, Plus } from 'lucide-react';
import { api, ENDPOINTS } from '@/lib/api';
import type { EvidenceLink, EvidenceByRole, Role } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

const EVIDENCE_ICONS: Record<string, string> = {
  url: '🔗',
  drive: '📁',
  onedrive: '🗂',
  sharepoint: '🗂',
  repository: '💻',
  file: '📄',
};

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  url: 'URL',
  drive: 'Google Drive',
  onedrive: 'OneDrive',
  sharepoint: 'SharePoint',
  repository: 'Repositorio',
  file: 'Archivo',
};

const ROLES: Role[] = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

const EMPTY_EVIDENCE: EvidenceByRole = {
  expert: [],
  pedagogy: [],
  design: [],
  audiovisual: [],
  engineering: [],
  qa: [],
};

// Mock evidence for fallback
function buildMockEvidence(deliverableId: number): EvidenceByRole {
  return {
    ...EMPTY_EVIDENCE,
    expert: [
      {
        id: 1,
        role_activity_id: deliverableId * 10 + 1,
        type: 'drive',
        title: 'Documento base del experto',
        url: 'https://drive.google.com/example',
        user: { id: 4, name: 'Laura Torres', email: 'laura@sergestiona.co', role: 'expert', is_active: true },
        created_at: '2026-05-20T10:00:00Z',
      },
    ],
    pedagogy: [
      {
        id: 2,
        role_activity_id: deliverableId * 10 + 2,
        type: 'url',
        title: 'Referencia pedagógica',
        url: 'https://example.com/pedagogia',
        user: { id: 5, name: 'Jhon Pérez', email: 'jhon@sergestiona.co', role: 'pedagogy', is_active: true },
        created_at: '2026-05-22T10:00:00Z',
      },
    ],
  };
}

interface EvidencePanelProps {
  deliverableId: number;
  activityId: number;
  role: string;
}

interface NewLinkForm {
  type: string;
  title: string;
  url: string;
}

export default function EvidencePanel({ deliverableId, activityId, role }: EvidencePanelProps) {
  const [evidence, setEvidence] = useState<EvidenceByRole>(EMPTY_EVIDENCE);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [role]: true });
  const [newLink, setNewLink] = useState<NewLinkForm>({ type: 'url', title: '', url: '' });
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Current user id — in real app from auth context
  const currentUserId = 4; // Laura Torres (mock)

  useEffect(() => {
    api
      .get<EvidenceByRole>(ENDPOINTS.DELIVERABLE_EVIDENCE(deliverableId))
      .then((data) => setEvidence(data))
      .catch(() => setEvidence(buildMockEvidence(deliverableId)))
      .finally(() => setLoading(false));
  }, [deliverableId]);

  function toggleSection(r: string) {
    setExpanded((prev) => ({ ...prev, [r]: !prev[r] }));
  }

  async function handleAdd() {
    if (!newLink.title.trim() || !newLink.url.trim()) return;
    setAdding(true);
    try {
      const created = await api.post<EvidenceLink>(
        ENDPOINTS.ACTIVITY_EVIDENCE(activityId),
        { type: newLink.type, title: newLink.title, url: newLink.url }
      );
      setEvidence((prev) => ({
        ...prev,
        [role]: [...(prev[role as Role] ?? []), created],
      }));
      setNewLink({ type: 'url', title: '', url: '' });
    } catch {
      // Optimistic mock add
      const mockLink: EvidenceLink = {
        id: Date.now(),
        role_activity_id: activityId,
        type: newLink.type as EvidenceLink['type'],
        title: newLink.title,
        url: newLink.url,
        user: { id: currentUserId, name: 'Laura Torres', email: 'laura@sergestiona.co', role: 'expert', is_active: true },
        created_at: new Date().toISOString(),
      };
      setEvidence((prev) => ({
        ...prev,
        [role]: [...(prev[role as Role] ?? []), mockLink],
      }));
      setNewLink({ type: 'url', title: '', url: '' });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(roleKey: Role, linkId: number) {
    setDeletingId(linkId);
    try {
      await api.delete<void>(`/evidence/${linkId}`);
    } catch {
      // ignore — proceed with optimistic removal
    }
    setEvidence((prev) => ({
      ...prev,
      [roleKey]: (prev[roleKey] ?? []).filter((l) => l.id !== linkId),
    }));
    setDeletingId(null);
  }

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {ROLES.map((r) => {
        const links = evidence[r] ?? [];
        const isOpen = !!expanded[r];
        const isActiveRole = r === role;

        return (
          <div key={r}>
            {/* Accordion header */}
            <button
              onClick={() => toggleSection(r)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">{ROLE_LABELS[r]}</span>
                <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                  {links.length}
                </span>
                {isActiveRole && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">
                    Tu rol
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronDown size={16} className="text-gray-400" />
              ) : (
                <ChevronRight size={16} className="text-gray-400" />
              )}
            </button>

            {isOpen && (
              <div className="px-4 pb-3 space-y-2">
                {links.length === 0 && (
                  <p className="text-xs text-gray-400 py-2 text-center">Sin evidencias registradas.</p>
                )}

                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <span className="text-base flex-shrink-0 mt-0.5">{EVIDENCE_ICONS[link.type] ?? '📄'}</span>
                    <div className="flex-1 min-w-0">
                      {link.url ? (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 truncate"
                        >
                          {link.title}
                          <ExternalLink size={11} className="flex-shrink-0" />
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-gray-800 truncate">{link.title}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {link.user?.name ?? 'Desconocido'} ·{' '}
                        {new Date(link.created_at).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    {link.user?.id === currentUserId && (
                      <button
                        onClick={() => handleDelete(r, link.id)}
                        disabled={deletingId === link.id}
                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 disabled:opacity-40"
                        title="Eliminar enlace"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {/* Add form — only for active role */}
                {isActiveRole && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agregar enlace</p>
                    <select
                      value={newLink.type}
                      onChange={(e) => setNewLink((f) => ({ ...f, type: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    >
                      {Object.entries(EVIDENCE_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <input
                      value={newLink.title}
                      onChange={(e) => setNewLink((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Título del enlace"
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                    />
                    <input
                      value={newLink.url}
                      onChange={(e) => setNewLink((f) => ({ ...f, url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                    />
                    <button
                      onClick={handleAdd}
                      disabled={adding || !newLink.title.trim() || !newLink.url.trim()}
                      className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus size={14} />
                      {adding ? 'Agregando...' : 'Agregar enlace'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
