'use client';

import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { clsx } from 'clsx';

interface CommentUser {
  id: number;
  name: string;
}

interface Comment {
  id: number;
  user: CommentUser;
  content: string;
  created_at: string;
}

interface CommentThreadProps {
  deliverableId: number;
  deliverableName?: string;
}

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-teal-500',
];

function getAvatarColor(userId: number) {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins}min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) {
    return `Ayer ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return date.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' });
}

const MOCK_COMMENTS: Comment[] = [
  {
    id: 1,
    user: { id: 1, name: 'Ana Rodríguez' },
    content: 'Revisar la estructura de contenidos antes de enviar al siguiente rol.',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 2,
    user: { id: 2, name: 'Carlos Méndez' },
    content: 'Aprobado en primera revisión. Pendiente ajuste menor en la introducción.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 3,
    user: { id: 1, name: 'Ana Rodríguez' },
    content: 'Ajuste realizado. Listo para revisión final.',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export default function CommentThread({ deliverableId }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('sergestiona_token') : null;
    if (!token) {
      setComments(MOCK_COMMENTS);
      setLoading(false);
      return;
    }
    fetch(`http://localhost:8000/api/deliverables/${deliverableId}/comments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setComments(list.length > 0 ? list : MOCK_COMMENTS);
      })
      .catch(() => setComments(MOCK_COMMENTS))
      .finally(() => setLoading(false));
  }, [deliverableId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('sergestiona_token') : null;
    try {
      if (token) {
        const res = await fetch(`http://localhost:8000/api/deliverables/${deliverableId}/comments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: text }),
        });
        if (res.ok) {
          const saved: Comment = await res.json();
          setComments((prev) => [...prev, saved]);
          setText('');
          setSending(false);
          return;
        }
      }
    } catch {
      // fallback
    }
    // Mock fallback
    const newComment: Comment = {
      id: Date.now(),
      user: { id: 99, name: 'Yo' },
      content: text,
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, newComment]);
    setText('');
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 pt-4 pb-2 border-b border-gray-100">
        Comentarios
      </p>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gray-200 rounded w-24" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && comments.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            No hay comentarios aún. Sé el primero en comentar.
          </p>
        )}

        {!loading &&
          comments.map((comment, idx) => {
            const showDayDivider =
              idx === 0 || !isSameDay(comments[idx - 1].created_at, comment.created_at);
            return (
              <div key={comment.id}>
                {showDayDivider && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                      {formatDayLabel(comment.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                      getAvatarColor(comment.user.id)
                    )}
                  >
                    {getInitials(comment.user.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-gray-900">
                        {comment.user.name}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatRelativeTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{comment.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-6 py-4">
        <div className="flex gap-2 items-end">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Escribe un comentario... (Ctrl+Enter para enviar)"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-900 placeholder:text-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="flex-shrink-0 bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            title="Enviar (Ctrl+Enter)"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
