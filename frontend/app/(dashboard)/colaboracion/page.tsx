'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MessagesSquare, Plus, Send, Hash, Users, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Channel, ChannelMessage } from '@/lib/types';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';

// ── helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  return isToday
    ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function highlightMentions(text: string) {
  return text.split(/(@[\w.]+)/g).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-indigo-600 font-medium">{part}</span>
      : part
  );
}

// ── component ─────────────────────────────────────────────────────────────────
export default function ColaboracionPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';

  const [channels, setChannels]       = useState<Channel[]>([]);
  const [activeId, setActiveId]       = useState<number | null>(null);
  const [messages, setMessages]       = useState<ChannelMessage[]>([]);
  const [text, setText]               = useState('');
  const [sending, setSending]         = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyTo, setReplyTo]         = useState<ChannelMessage | null>(null);

  // New channel modal
  const [newOpen, setNewOpen]   = useState(false);
  const [newName, setNewName]   = useState('');
  const [creating, setCreating] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChannel = channels.find((c) => c.id === activeId) ?? null;

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const res = await api.get<{ channels: Channel[] }>('/channels');
      setChannels(res.channels ?? []);
      if (res.channels?.length && !activeId) {
        setActiveId(res.channels[0].id);
      }
    } finally {
      setLoadingChannels(false);
    }
  }, [activeId]);

  const loadMessages = useCallback(async (channelId: number) => {
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const res = await api.get<{ messages: ChannelMessage[] }>(`/channels/${channelId}/messages`);
      setMessages(res.messages ?? []);
      // Mark as read
      api.post(`/channels/${channelId}/read`, {}).catch(() => null);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim() || !activeId) return;
    setSending(true);
    try {
      const payload: { content: string; parent_id?: number } = { content: text.trim() };
      if (replyTo) payload.parent_id = replyTo.id;

      const res = await api.post<ChannelMessage>(`/channels/${activeId}/messages`, payload);
      setMessages((prev) => [...prev, res]);
      setText('');
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handleCreateChannel() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post('/channels', { name: newName.trim(), type: 'general' });
      setNewName('');
      setNewOpen(false);
      loadChannels();
    } finally {
      setCreating(false);
    }
  }

  async function joinChannel(ch: Channel) {
    await api.post(`/channels/${ch.id}/join`, {});
    setActiveId(ch.id);
    loadChannels();
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* ── Sidebar ── */}
      <div className="w-64 flex-none border-r border-gray-100 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">Canales</span>
          {isManager && (
            <button
              onClick={() => setNewOpen(true)}
              className="text-gray-400 hover:text-indigo-600 transition-colors"
              title="Nuevo canal"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loadingChannels ? (
            <div className="px-4 text-xs text-gray-400 py-2">Cargando…</div>
          ) : channels.length === 0 ? (
            <div className="px-4 text-xs text-gray-400 py-4">No hay canales.</div>
          ) : (
            channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveId(ch.id)}
                className={clsx(
                  'w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors',
                  activeId === ch.id
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <Hash size={13} className="flex-none opacity-60" />
                <span className="flex-1 truncate">{ch.name}</span>
                {(ch.unread_count ?? 0) > 0 && (
                  <span className="ml-auto text-xs bg-indigo-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                    {ch.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Users size={12} />
            <span>{user?.name}</span>
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {activeChannel ? (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
            <Hash size={15} className="text-gray-400" />
            <span className="font-semibold text-gray-800 text-sm">{activeChannel.name}</span>
            {activeChannel.project && (
              <>
                <ChevronRight size={13} className="text-gray-300" />
                <span className="text-xs text-gray-400">{activeChannel.project.name}</span>
              </>
            )}
          </div>
        ) : (
          <div className="px-5 py-3 border-b border-gray-100" />
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!activeId ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
              <MessagesSquare size={40} />
              <p className="text-sm">Selecciona un canal</p>
            </div>
          ) : loadingMsgs ? (
            <div className="text-xs text-gray-400">Cargando mensajes…</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
              <MessagesSquare size={36} />
              <p className="text-sm">Sin mensajes aún. ¡Sé el primero!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="group flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-none">
                  {msg.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-gray-800">{msg.user.name}</span>
                    <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="ml-auto text-xs text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Responder
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {highlightMentions(msg.content)}
                  </p>
                  {/* Replies */}
                  {msg.replies && msg.replies.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-gray-100 space-y-1">
                      {msg.replies.map((r) => (
                        <div key={r.id} className="flex gap-2">
                          <span className="text-xs font-medium text-gray-600">{r.user?.name}</span>
                          <span className="text-xs text-gray-500 whitespace-pre-wrap">
                            {highlightMentions(r.content)}
                          </span>
                          <span className="text-xs text-gray-300 ml-auto">{formatTime(r.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {activeId && (
          <div className="px-5 py-3 border-t border-gray-100">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 bg-gray-50 rounded px-3 py-1">
                <span>Respondiendo a <strong>{replyTo.user.name}</strong>:</span>
                <span className="truncate max-w-xs">{replyTo.content.slice(0, 60)}</span>
                <button onClick={() => setReplyTo(null)} className="ml-auto hover:text-gray-600">✕</button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={`Mensaje en #${activeChannel?.name ?? ''}… Usa @nombre para mencionar`}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !text.trim()}
                className="flex-none flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-1">Enter para enviar · Shift+Enter nueva línea</p>
          </div>
        )}
      </div>

      {/* New Channel Modal */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nuevo Canal"
        size="sm"
        footer={
          <>
            <button onClick={() => setNewOpen(false)} className="px-4 py-2 text-sm text-gray-600">
              Cancelar
            </button>
            <button
              onClick={handleCreateChannel}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? 'Creando…' : 'Crear'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del canal</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
              placeholder="ej: diseño-general, qa-revisiones"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
