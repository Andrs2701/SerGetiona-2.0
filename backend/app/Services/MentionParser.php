<?php

namespace App\Services;

use App\Models\ChannelMessage;
use App\Models\Mention;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

final class MentionParser
{
    /**
     * Detecta @menciones en el contenido, persiste registros Mention y
     * notifica a los usuarios mencionados. Pasar message_id o comment_id.
     *
     * Resuelve tres formatos: handle generado por el autocompletado
     * ("@carlos.ramirez" para "Carlos Ramírez"), nombre exacto sin espacios
     * ("@carloslopez") y correo ("@carlos@dominio.co").
     */
    public static function record(string $content, ?int $messageId = null, ?int $commentId = null): void
    {
        preg_match_all('/@([\p{L}\p{N}][\p{L}\p{N}._@-]*)/u', $content, $matches);
        if (empty($matches[1])) {
            return;
        }

        $candidates = array_unique(array_map(
            fn (string $c) => mb_strtolower(rtrim($c, '.')),
            $matches[1]
        ));

        $mentioned = User::where('is_active', true)
            ->get()
            ->filter(function (User $user) use ($candidates) {
                $handle = self::toHandle($user->name);
                $name   = mb_strtolower($user->name);
                $email  = mb_strtolower($user->email);

                return !empty(array_intersect($candidates, [$handle, $name, $email]));
            });

        if ($mentioned->isEmpty()) {
            return;
        }

        $actorId = Auth::id();

        // Contexto del canal para la notificación y para respetar privacidad
        $channel = null;
        if ($messageId) {
            $channel = ChannelMessage::with('channel')->find($messageId)?->channel;
        }

        $snippet = Str::limit(trim($content), 80);

        foreach ($mentioned->unique('id') as $user) {
            if ($actorId && (int) $user->id === (int) $actorId) {
                continue; // no auto-menciones
            }

            // En canales privados solo se notifica a quienes pueden verlo
            if ($channel && !$channel->isVisibleTo($user)) {
                continue;
            }

            Mention::create([
                'message_id'        => $messageId,
                'comment_id'        => $commentId,
                'mentioned_user_id' => $user->id,
                'created_by'        => $actorId,
                'created_at'        => now(),
            ]);

            $where = $channel ? " en el canal '{$channel->name}'" : ' en un comentario';
            NotificationService::notify(
                $user,
                'mention',
                'Te mencionaron',
                (Auth::user()?->name ?? 'Alguien') . " te mencionó{$where}: \"{$snippet}\"",
                [
                    'message_id' => $messageId,
                    'comment_id' => $commentId,
                    'channel_id' => $channel?->id,
                ]
            );
        }
    }

    /** "Carlos Ramírez" → "carlos.ramirez" (igual que el autocompletado del frontend) */
    public static function toHandle(string $name): string
    {
        return (string) Str::of($name)
            ->ascii()
            ->lower()
            ->replaceMatches('/\s+/', '.');
    }
}
