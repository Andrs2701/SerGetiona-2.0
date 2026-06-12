'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserMinus, UserPlus, Lock, Hash } from 'lucide-react';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import type { Channel, ChannelMember, User } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  coordinator: 'Coordinador',
  expert: 'Experto',
  pedagogy: 'Pedagogía',
  design: 'Diseño',
  audiovisual: 'Audiovisual',
  engineering: 'Ingeniería',
  qa: 'Calidad',
};

interface Props {
  channel: Channel | null;
  canManage: boolean;
  allUsers: User[];
  onClose: () => void;
  onChanged?: () => void;
}

export default function ChannelMembersModal({ channel, canManage, allUsers, onClose, onChanged }: Props) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | ''>('');

  const load = useCallback(async () => {
    if (!channel) return;
    setLoading(true);
    try {
      const res = await api.get<{ members: ChannelMember[] }>(`/channels/${channel.id}/members`);
      setMembers(res.members ?? []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    setSelectedId('');
    load();
  }, [load]);

  async function handleAdd() {
    if (!channel || selectedId === '') return;
    setWorking(-1);
    try {
      await api.post(`/channels/${channel.id}/members`, { user_id: selectedId });
      setSelectedId('');
      await load();
      onChanged?.();
    } catch {
      alert('No se pudo agregar el usuario.');
    } finally {
      setWorking(null);
    }
  }

  async function handleRemove(member: ChannelMember) {
    if (!channel) return;
    if (!confirm(`¿Quitar a ${member.name} del canal?`)) return;
    setWorking(member.id);
    try {
      await api.delete(`/channels/${channel.id}/members/${member.id}`);
      await load();
      onChanged?.();
    } catch {
      alert('No se pudo quitar el usuario.');
    } finally {
      setWorking(null);
    }
  }

  const available = allUsers.filter(
    (u) => u.is_active !== false && !members.some((m) => m.id === u.id)
  );

  return (
    <Modal
      open={!!channel}
      onClose={onClose}
      title={
        channel
          ? `Miembros de ${channel.is_private ? '🔒' : '#'}${channel.name}`
          : 'Miembros'
      }
      size="sm"
    >
      <div className="space-y-4">
        {channel?.is_private ? (
          <p className="text-xs text-gray-500 flex items-center gap-1.5 bg-amber-50 text-amber-700 rounded-lg px-3 py-2">
            <Lock size={12} className="flex-shrink-0" />
            Canal privado: solo los miembros pueden ver y escribir mensajes.
          </p>
        ) : (
          <p className="text-xs text-gray-500 flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
            <Hash size={12} className="flex-shrink-0" />
            Canal público: cualquier usuario puede unirse y participar.
          </p>
        )}

        {/* Agregar miembro (solo gestión) */}
        {canManage && (
          <div className="flex gap-2">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : '')}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Agregar usuario…</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({ROLE_LABELS[u.role] ?? u.role})
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={selectedId === '' || working === -1}
              className="flex-none flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              <UserPlus size={14} />
              Agregar
            </button>
          </div>
        )}

        {/* Lista de miembros */}
        {loading ? (
          <div className="text-xs text-gray-400 py-4 text-center">Cargando miembros…</div>
        ) : (
          <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg max-h-72 overflow-y-auto">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-none">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[m.role] ?? m.role}</p>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleRemove(m)}
                    disabled={working === m.id}
                    className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Quitar del canal"
                  >
                    <UserMinus size={15} />
                  </button>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <div className="px-3 py-6 text-center text-gray-400 text-sm">Sin miembros aún.</div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
