'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MessagesSquare, Plus, Send, Hash, Users, ChevronRight, AtSign } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Channel, ChannelMessage, User } from '@/lib/types';
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
      ? <span key={i} className="bg-indigo-100 text-indigo-700 rounded px-0.5 font-medium">{part}</span>
      : part
  );
}

/** Convierte nombre a handle: "Carlos Ramírez" → "carlos.ramirez" */
function toHandle(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/\s+/g, '.');
}

/** Extrae el fragmento @query activo en el cursor */
function getMentionQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const match = before.match(/@([\w.]*)$/);
  return match ? match[1] : null;
}

// ── mention autocomplete ──────────────────────────────────────────────────────
interface MentionDropdownProps {
  users: User[];
  query: string;
  onSelect: (handle: string) => void;
}

function MentionDropdown({ users, query, onSelect }: MentionDropdownProps) {
  const filtered = users.filter((u) =>
    toHandle(u.name).includes(query.toLowerCase()) ||
    u.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
        <AtSign size={11} className="text-gray-400" />
        <span className="text-xs text-gray-500 font-medium">Mencionar usuario</span>
      </div>
      {filtered.map((u) => (
        <button
          key={u.id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(toHandle(u.name)); }}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-none">
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
            <p className="text-xs text-gray-400">@{toHandle(u.name)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function ColaboracionPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';

  const [channels, setChannels]             = useState<Channel[]>([]);
  const [activeId, setActiveId]             = useState<number | null>(null);
  const [messages, setMessages]             = useState<ChannelMessage[]>([]);
  const [text, setText]                     = useState('');
  const [sending, setSending]               = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMsgs, setLoadingMsgs]       = useState(false);
  const [replyTo, setReplyTo]               = useState<ChannelMessage | null>(null);

  // Mention autocomplete
  const [allUsers, setAllUsers]             = useState<User[]>([]);
  const [mentionQuery, setMentionQuery]     = useState<string | null>(null);
  const [cursorPos, setCursorPos]           = useState(0);

  // New channel modal
  const [newOpen, setNewOpen]   = useState(false);
  const [newName, setNewName]   = useState('');
  const [creating, setCreating] = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChannel = channels.find((c) => c.id === activeId) ?? null;

  // Load users for mention autocomplete
  useEffect(() => {
    api.get<unknown>('/users').then((res) => {
      const arr = Array.isArray(res) ? res : (res as { data?: User[] }).data ?? [];
      setAllUsers(arr as User[]);
    }).catch(() => null);
  }, []);

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
      api.post(`/channels/${channelId}/read`, {}).catch(() => null);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => { loadChannels(); }, []);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId, loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── textarea change with @mention detection ───────────────────────────────
  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setText(val);
    setCursorPos(pos);
    setMentionQuery(getMentionQuery(val, pos));
  }

  function handleTextClick(e: React.MouseEvent<HTMLTextAreaElement>) {
    const pos = e.currentTarget.selectionStart ?? text.length;
    setCursorPos(pos);
    setMentionQuery(getMentionQuery(text, pos));
  }

  // ── insert mention from dropdown ──────────────────────────────────────────
  function insertMention(handle: string) {
    const before = text.slice(0, cursorPos);
    const after  = text.slice(cursorPos);
    // Replace the @query fragment with the selected handle
    const replaced = before.replace(/@[\w.]*$/, `@${handle} `);
    setText(replaced + after);
    setMentionQuery(null);
    // Refocus
    setTimeout(() => {
      textareaRef.current?.focus();
      const newPos = replaced.length;
      textareaRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  }

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
      setMentionQuery(null);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Dismiss dropdown with Escape
    if (e.key === 'Escape' && mentionQuery !== null) {
      setMentionQuery(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
                    <span className="text-sm font-semibold text-gray-900">{msg.user.name}</span>
                    <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="ml-auto text-xs text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Responder
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {highlightMentions(msg.content)}
                  </p>
                  {/* Thread replies */}
                  {msg.replies && msg.replies.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-indigo-100 space-y-1.5">
                      {msg.replies.map((r) => (
                        <div key={r.id} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-none mt-0.5">
                            {r.user?.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-600">{r.user?.name} </span>
                            <span className="text-xs text-gray-500 whitespace-pre-wrap">
                              {highlightMentions(r.content)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-300 ml-auto whitespace-nowrap">{formatTime(r.created_at)}</span>
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

        {/* Input area */}
        {activeId && (
          <div className="px-5 py-3 border-t border-gray-100">
            {/* Reply indicator */}
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5">
                <span>Respondiendo a <strong className="text-gray-600">{replyTo.user.name}</strong>:</span>
                <span className="truncate max-w-xs opacity-70">{replyTo.content.slice(0, 60)}</span>
                <button onClick={() => setReplyTo(null)} className="ml-auto hover:text-gray-700 font-medium">✕</button>
              </div>
            )}

            {/* Textarea wrapper with mention dropdown */}
            <div className="relative flex gap-2">
              {/* Mention dropdown — renders above the input */}
              {mentionQuery !== null && (
                <div className="absolute bottom-full left-0 w-full mb-1">
                  <MentionDropdown
                    users={allUsers}
                    query={mentionQuery}
                    onSelect={insertMention}
                  />
                </div>
              )}

              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleTextChange}
                  onClick={handleTextClick}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={`Mensaje en #${activeChannel?.name ?? ''}… escribe @ para mencionar`}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
                {/* @ hint icon inside input */}
                <AtSign size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              </div>

              <button
                onClick={sendMessage}
                disabled={sending || !text.trim()}
                className="flex-none flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-1.5">
              <kbd className="font-mono">Enter</kbd> envía · <kbd className="font-mono">Shift+Enter</kbd> nueva línea · <kbd className="font-mono">@</kbd> menciona a alguien
            </p>
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
            <button onClick={() => setNewOpen(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
            <button
              onClick={handleCreateChannel}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? 'Creando…' : 'Crear canal'}
            </button>
          </>
        }
      >
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
          <p className="text-xs text-gray-400 mt-1.5">Usa guiones en lugar de espacios.</p>
        </div>
      </Modal>
    </div>
  );
}
