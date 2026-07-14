'use client';

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  MessagesSquare, Plus, Send, Hash, Users, ChevronRight, AtSign, Lock,
  ArrowLeft, CornerDownRight, Copy, Check, Pencil, Trash2, ChevronDown, ChevronUp,
  MoreHorizontal, X, Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Channel, ChannelMessage, ChannelMember, User } from '@/lib/types';
import Modal from '@/components/Modal';
import ChannelMembersModal from '@/components/ChannelMembersModal';
import Avatar from '@/components/Avatar';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  if (d.toDateString() === yesterday.toDateString()) return `Ayer ${time}`;
  return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} ${time}`;
}

function dateSeparatorLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoy';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function highlightMentions(text: string) {
  return text.split(/(@[\w.]+)/g).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded px-1 py-0.5 font-medium text-[13px]">{part}</span>
      : part
  );
}

function toHandle(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.');
}

function getMentionQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const match = before.match(/@([\w.]*)$/);
  return match ? match[1] : null;
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', coordinator: 'Coord.', expert: 'Experto',
  pedagogy: 'Pedagogía', design: 'Diseño', audiovisual: 'Audiovisual',
  engineering: 'Ingeniería', qa: 'QA',
};

// ── MentionDropdown ──────────────────────────────────────────────────────────

function MentionDropdown({
  members, query, onSelect, currentUserId,
}: {
  members: ChannelMember[];
  query: string;
  onSelect: (handle: string) => void;
  currentUserId?: number;
}) {
  const filtered = members
    .filter(m => m.id !== currentUserId)
    .filter(m =>
      toHandle(m.name).includes(query.toLowerCase()) ||
      m.name.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 8);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex items-center gap-1.5">
        <AtSign size={12} className="text-indigo-500" />
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Mencionar miembro del canal</span>
      </div>
      {filtered.map(m => (
        <button
          key={m.id}
          onMouseDown={e => { e.preventDefault(); onSelect(toHandle(m.name)); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
        >
          <Avatar
            name={m.name}
            photoUrl={m.photo_url}
            className={clsx('w-7 h-7 text-xs text-white flex-none', avatarColor(m.id))}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{m.name}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">@{toHandle(m.name)} · {ROLE_LABELS[m.role] ?? m.role}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── MessageActions ───────────────────────────────────────────────────────────

function MessageActions({
  isAuthor, isManager, onReply, onEdit, onDelete, onCopy,
}: {
  isAuthor: boolean;
  isManager: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-0.5">
        <button onClick={onReply} className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors" title="Responder">
          <CornerDownRight size={14} />
        </button>
        <button onClick={() => setOpen(!open)} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Más opciones">
          <MoreHorizontal size={14} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
          <button onClick={() => { onReply(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <CornerDownRight size={14} /> Responder
          </button>
          <button onClick={() => { onCopy(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Copy size={14} /> Copiar texto
          </button>
          {isAuthor && (
            <button onClick={() => { onEdit(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Pencil size={14} /> Editar
            </button>
          )}
          {(isAuthor || isManager) && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              <button onClick={() => { onDelete(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 size={14} /> Eliminar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

function ColaboracionInner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'coordinator';

  // Core state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyTo, setReplyTo] = useState<ChannelMessage | null>(null);

  // Members & mentions
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState(0);

  // Edit mode
  const [editingMsg, setEditingMsg] = useState<ChannelMessage | null>(null);
  const [editText, setEditText] = useState('');

  // Thread expand
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set());

  // Copy feedback
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // New channel modal
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [newMemberIds, setNewMemberIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  // Members modal
  const [membersChannel, setMembersChannel] = useState<Channel | null>(null);

  // Edit channel modal
  const [editChannel, setEditChannel] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelIsPrivate, setEditChannelIsPrivate] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);

  // Mobile
  const [mobileShowMessages, setMobileShowMessages] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeChannel = channels.find(c => c.id === activeId) ?? null;

  // Fallback mention list: channel members if available, otherwise all users
  const mentionList: ChannelMember[] = useMemo(() => {
    if (channelMembers.length > 0) return channelMembers;
    return allUsers.map(u => ({ id: u.id, name: u.name, email: u.email ?? '', role: u.role } as ChannelMember));
  }, [channelMembers, allUsers]);

  // ── data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    api.get<unknown>('/users').then(res => {
      const arr = Array.isArray(res) ? res : (res as { data?: User[] }).data ?? [];
      setAllUsers(arr as User[]);
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (!activeId) { setChannelMembers([]); return; }
    api.get<{ members: ChannelMember[] }>(`/channels/${activeId}/members`)
      .then(res => setChannelMembers(res.members ?? []))
      .catch(() => setChannelMembers([]));
  }, [activeId]);

  const deepLinkChannelId = searchParams.get('channel');

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const res = await api.get<{ channels: Channel[] }>('/channels');
      setChannels(res.channels ?? []);
      if (res.channels?.length && !activeId) {
        const target = deepLinkChannelId ? Number(deepLinkChannelId) : null;
        const match = target && res.channels.find(c => c.id === target);
        setActiveId(match ? match.id : res.channels[0].id);
        if (match) setMobileShowMessages(true);
      }
    } finally {
      setLoadingChannels(false);
    }
  }, [activeId, deepLinkChannelId]);

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

  useEffect(() => { loadChannels(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId, loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── mention handling ─────────────────────────────────────────────────────

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

  function insertMention(handle: string) {
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    const replaced = before.replace(/@[\w.]*$/, `@${handle} `);
    setText(replaced + after);
    setMentionQuery(null);
    setTimeout(() => {
      textareaRef.current?.focus();
      const newPos = replaced.length;
      textareaRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  }

  // ── send / edit / delete ─────────────────────────────────────────────────

  async function sendMessage() {
    if (!text.trim() || !activeId) return;
    setSending(true);
    try {
      const payload: { content: string; parent_id?: number } = { content: text.trim() };
      if (replyTo) payload.parent_id = replyTo.id;
      const res = await api.post<ChannelMessage>(`/channels/${activeId}/messages`, payload);
      setMessages(prev => [...prev, res]);
      setText('');
      setReplyTo(null);
      setMentionQuery(null);
      loadChannels();
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      if (mentionQuery !== null) { setMentionQuery(null); return; }
      if (replyTo) { setReplyTo(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function submitEdit() {
    if (!editingMsg || !editText.trim() || !activeId) return;
    try {
      await api.put(`/channels/${activeId}/messages/${editingMsg.id}`, { content: editText.trim() });
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: editText.trim() } : m));
    } catch { /* endpoint may not exist */ }
    setEditingMsg(null);
    setEditText('');
  }

  async function handleDeleteMessage(msg: ChannelMessage) {
    if (!activeId || !confirm('¿Eliminar este mensaje?')) return;
    try {
      await api.delete(`/channels/${activeId}/messages/${msg.id}`);
      setMessages(prev => prev.filter(m => m.id !== msg.id));
    } catch { /* endpoint may not exist */ }
  }

  async function handleCopyMessage(msg: ChannelMessage) {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  }

  function handleEditMessage(msg: ChannelMessage) {
    setEditingMsg(msg);
    setEditText(msg.content);
  }

  function toggleThread(msgId: number) {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  }

  // ── create channel ───────────────────────────────────────────────────────

  async function handleCreateChannel() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post('/channels', {
        name: newName.trim(),
        type: 'general',
        is_private: newIsPrivate,
        member_ids: newIsPrivate ? newMemberIds : [],
      });
      setNewName('');
      setNewIsPrivate(false);
      setNewMemberIds([]);
      setNewOpen(false);
      loadChannels();
    } finally {
      setCreating(false);
    }
  }

  // ── edit channel (nombre / público-privado) ──────────────────────────────

  function openEditChannel(ch: Channel) {
    setEditChannel(ch);
    setEditChannelName(ch.name);
    setEditChannelIsPrivate(!!ch.is_private);
  }

  async function handleUpdateChannel() {
    if (!editChannel || !editChannelName.trim()) return;
    setSavingChannel(true);
    try {
      await api.put(`/channels/${editChannel.id}`, {
        name: editChannelName.trim(),
        is_private: editChannelIsPrivate,
      });
      setEditChannel(null);
      loadChannels();
    } finally {
      setSavingChannel(false);
    }
  }

  // ── date separators ──────────────────────────────────────────────────────

  const enrichedMessages = useMemo(() => {
    const result: Array<{ type: 'sep'; date: string } | { type: 'msg'; msg: ChannelMessage; grouped: boolean }> = [];
    let lastDate = '';
    let lastUserId = -1;
    let lastTime = 0;
    for (const msg of messages) {
      const dateKey = new Date(msg.created_at).toDateString();
      if (dateKey !== lastDate) {
        result.push({ type: 'sep', date: msg.created_at });
        lastDate = dateKey;
        lastUserId = -1;
      }
      const msgTime = new Date(msg.created_at).getTime();
      const grouped = msg.user.id === lastUserId && (msgTime - lastTime) < 300_000;
      result.push({ type: 'msg', msg, grouped });
      lastUserId = msg.user.id;
      lastTime = msgTime;
    }
    return result;
  }, [messages]);

  // ── last activity label ──────────────────────────────────────────────────

  const lastActivity = useMemo(() => {
    if (!activeChannel?.last_message_at) return null;
    const d = new Date(activeChannel.last_message_at);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Activo ahora';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH}h`;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }, [activeChannel]);

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col sm:flex-row h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700">

      {/* ── Channel sidebar ── */}
      <div className={clsx(
        'sm:w-64 sm:flex-none border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-gray-700 flex flex-col flex-shrink-0',
        mobileShowMessages ? 'hidden sm:flex' : 'flex w-full'
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Canales</span>
          {isManager && (
            <button onClick={() => setNewOpen(true)} className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Nuevo canal">
              <Plus size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {loadingChannels ? (
            <div className="px-4 text-xs text-gray-400 dark:text-gray-500 py-3">Cargando…</div>
          ) : channels.length === 0 ? (
            <div className="px-4 text-xs text-gray-400 dark:text-gray-500 py-4">No hay canales.</div>
          ) : (
            channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => { setActiveId(ch.id); setMobileShowMessages(true); }}
                className={clsx(
                  'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors',
                  activeId === ch.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/25 text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                )}
              >
                {ch.is_private
                  ? <Lock size={13} className="flex-none opacity-60 text-amber-500" />
                  : <Hash size={13} className="flex-none opacity-60" />}
                <span className="flex-1 truncate">{ch.name}</span>
                {(ch.unread_count ?? 0) > 0 && (
                  <span className="text-[10px] bg-indigo-500 text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center leading-none font-bold">
                    {ch.unread_count! > 99 ? '99+' : ch.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-none" />
            <span className="truncate">{user?.name}</span>
          </div>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className={clsx('flex-1 flex flex-col overflow-hidden', mobileShowMessages ? 'flex' : 'hidden sm:flex')}>

        {/* Channel header */}
        {activeChannel ? (
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <button
              onClick={() => setMobileShowMessages(false)}
              className="sm:hidden p-1 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            {activeChannel.is_private
              ? <Lock size={15} className="text-amber-500 flex-none" />
              : <Hash size={15} className="text-gray-400 dark:text-gray-500 flex-none" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{activeChannel.name}</span>
                {activeChannel.project && (
                  <>
                    <ChevronRight size={13} className="text-gray-300 dark:text-gray-600 flex-none" />
                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{activeChannel.project.name}</span>
                  </>
                )}
              </div>
              {lastActivity && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Última actividad: {lastActivity}</p>
              )}
            </div>
            {isManager && (
              <button
                onClick={() => openEditChannel(activeChannel)}
                className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex-none"
                title="Editar canal"
              >
                <Settings size={15} />
              </button>
            )}
            <button
              onClick={() => setMembersChannel(activeChannel)}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-none"
              title={isManager ? 'Gestionar miembros' : 'Ver miembros'}
            >
              <Users size={14} />
              <span className="hidden sm:inline">Miembros</span>
              {typeof activeChannel.member_count === 'number' && (
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-1.5 py-0.5 leading-none font-medium">
                  {activeChannel.member_count}
                </span>
              )}
            </button>
          </div>
        ) : (
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0" />
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
          {!activeId ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 gap-3">
              <MessagesSquare size={44} strokeWidth={1.5} />
              <p className="text-sm font-medium">Selecciona un canal para comenzar</p>
            </div>
          ) : loadingMsgs ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-xs text-gray-400 dark:text-gray-500">Cargando mensajes…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 gap-3">
              <MessagesSquare size={40} strokeWidth={1.5} />
              <p className="text-sm font-medium">Sin mensajes aún</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">¡Sé el primero en escribir!</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {enrichedMessages.map((item, idx) => {
                if (item.type === 'sep') {
                  return (
                    <div key={`sep-${idx}`} className="flex items-center gap-3 py-3 my-2">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {dateSeparatorLabel(item.date)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>
                  );
                }

                const { msg, grouped } = item;
                const isAuthor = msg.user.id === user?.id;
                const replies = msg.replies ?? [];
                const hasReplies = replies.length > 0;
                const isExpanded = expandedThreads.has(msg.id);

                return (
                  <div key={msg.id}>
                    {/* Main message */}
                    <div className="group flex gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-gray-50/70 dark:hover:bg-white/[0.03] transition-colors">
                      {/* Avatar or spacer for grouped messages */}
                      {grouped ? (
                        <div className="w-9 flex-none" />
                      ) : (
                        <Avatar
                          name={msg.user.name}
                          photoUrl={msg.user.photo_url}
                          className={clsx('w-9 h-9 text-xs text-white flex-none mt-0.5', avatarColor(msg.user.id))}
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Name + time (only for non-grouped) */}
                        {!grouped && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{msg.user.name}</span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatTime(msg.created_at)}</span>
                          </div>
                        )}

                        {/* Content or edit mode */}
                        {editingMsg?.id === msg.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditingMsg(null); }}
                              className="flex-1 text-sm border border-indigo-300 dark:border-indigo-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              autoFocus
                            />
                            <button onClick={submitEdit} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Guardar</button>
                            <button onClick={() => setEditingMsg(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {highlightMentions(msg.content)}
                          </p>
                        )}

                        {/* Thread summary (collapsed) */}
                        {hasReplies && !isExpanded && (
                          <button
                            onClick={() => toggleThread(msg.id)}
                            className="mt-1.5 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium group/thread"
                          >
                            {/* Stacked avatars */}
                            <div className="flex -space-x-1.5">
                              {replies.slice(0, 3).map((r, i) => (
                                <Avatar
                                  key={r.id}
                                  name={r.user?.name ?? '?'}
                                  photoUrl={r.user?.photo_url}
                                  className={clsx('w-5 h-5 text-[8px] text-white ring-2 ring-white dark:ring-gray-800', avatarColor(r.user?.id ?? i))}
                                  style={{ zIndex: 3 - i }}
                                />
                              ))}
                            </div>
                            <span>{replies.length === 1 ? '1 respuesta' : `${replies.length} respuestas`}</span>
                            <ChevronDown size={12} className="group-hover/thread:translate-y-0.5 transition-transform" />
                          </button>
                        )}
                      </div>

                      {/* Hover actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-none self-start mt-0.5">
                        {copiedId === msg.id ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium px-2 py-1"><Check size={12} /> Copiado</span>
                        ) : (
                          <MessageActions
                            isAuthor={isAuthor}
                            isManager={isManager}
                            onReply={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                            onEdit={() => handleEditMessage(msg)}
                            onDelete={() => handleDeleteMessage(msg)}
                            onCopy={() => handleCopyMessage(msg)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Thread replies (expanded) */}
                    {hasReplies && isExpanded && (
                      <div className="ml-12 pl-3 border-l-2 border-indigo-200 dark:border-indigo-800/50 space-y-0.5 mb-2">
                        {replies.map(r => (
                          <div key={r.id} className="flex items-start gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                            <Avatar
                              name={r.user?.name ?? '?'}
                              photoUrl={r.user?.photo_url}
                              className={clsx('w-6 h-6 text-[10px] text-white flex-none mt-0.5', avatarColor(r.user?.id ?? 0))}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{r.user?.name}</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatTime(r.created_at)}</span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                                {highlightMentions(r.content)}
                              </p>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => toggleThread(msg.id)}
                          className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-medium pl-2 pt-1"
                        >
                          <ChevronUp size={12} /> Ocultar respuestas
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        {activeId && (
          <div className="px-4 sm:px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            {/* Reply indicator */}
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 text-xs bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 border-l-2 border-indigo-400">
                <CornerDownRight size={12} className="text-indigo-400 flex-none" />
                <span className="text-gray-500 dark:text-gray-400">
                  Respondiendo a <strong className="text-gray-700 dark:text-gray-200">{replyTo.user.name}</strong>
                </span>
                <span className="truncate max-w-[200px] text-gray-400 dark:text-gray-500">{replyTo.content.slice(0, 60)}</span>
                <button onClick={() => setReplyTo(null)} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-none">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Textarea + mention dropdown */}
            <div className="relative flex gap-2">
              {mentionQuery !== null && (
                <MentionDropdown
                  members={mentionList}
                  query={mentionQuery}
                  onSelect={insertMention}
                  currentUserId={user?.id}
                />
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
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 pr-8 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600 resize-none transition-colors"
                />
                <AtSign size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-500 pointer-events-none" />
              </div>

              <button
                onClick={sendMessage}
                disabled={sending || !text.trim()}
                className="flex-none flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors self-end"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1.5 flex items-center gap-2 flex-wrap">
              <span><kbd className="font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1 rounded text-[10px]">Enter</kbd> envía</span>
              <span><kbd className="font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1 rounded text-[10px]">Shift+Enter</kbd> nueva línea</span>
              <span><kbd className="font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1 rounded text-[10px]">@</kbd> mencionar</span>
              <span><kbd className="font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1 rounded text-[10px]">Esc</kbd> cancelar</span>
            </p>
          </div>
        )}
      </div>

      {/* New Channel Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nuevo Canal" size="sm" footer={
        <>
          <button onClick={() => setNewOpen(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">Cancelar</button>
          <button
            onClick={handleCreateChannel}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? 'Creando…' : 'Crear canal'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nombre del canal</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
              placeholder="ej: diseño-general, qa-revisiones"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              autoFocus
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Usa guiones en lugar de espacios.</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={newIsPrivate} onChange={e => setNewIsPrivate(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
            <Lock size={13} className="text-amber-500" />
            Canal privado (solo los miembros que agregues podrán verlo)
          </label>

          {newIsPrivate && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Miembros iniciales</label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                {allUsers.filter(u => u.id !== user?.id).map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={newMemberIds.includes(u.id)}
                      onChange={e => setNewMemberIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    {u.name}
                  </label>
                ))}
                {allUsers.length === 0 && <p className="text-xs text-gray-400">No hay usuarios disponibles.</p>}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Tú quedas incluido automáticamente.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Channel Modal */}
      <Modal open={!!editChannel} onClose={() => setEditChannel(null)} title="Editar Canal" size="sm" footer={
        <>
          <button onClick={() => setEditChannel(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">Cancelar</button>
          <button
            onClick={handleUpdateChannel}
            disabled={savingChannel || !editChannelName.trim()}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingChannel ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nombre del canal</label>
            <input
              type="text"
              value={editChannelName}
              onChange={e => setEditChannelName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdateChannel()}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              autoFocus
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={editChannelIsPrivate} onChange={e => setEditChannelIsPrivate(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
            <Lock size={13} className="text-amber-500" />
            Canal privado (solo los miembros que agregues podrán verlo)
          </label>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {editChannelIsPrivate
              ? 'Los miembros actuales conservan su acceso. El historial de mensajes no se pierde.'
              : 'Todos podrán ver el canal. Los miembros actuales no cambian.'}
          </p>
        </div>
      </Modal>

      <ChannelMembersModal
        channel={membersChannel}
        canManage={isManager}
        allUsers={allUsers}
        onClose={() => setMembersChannel(null)}
        onChanged={loadChannels}
      />
    </div>
  );
}

export default function ColaboracionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <ColaboracionInner />
    </Suspense>
  );
}
