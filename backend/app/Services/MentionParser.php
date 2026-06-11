<?php

namespace App\Services;

use App\Models\Mention;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

final class MentionParser
{
    /**
     * Parse @mentions in content and persist Mention records + send notifications.
     * Pass either message_id or comment_id.
     */
    public static function record(string $content, ?int $messageId = null, ?int $commentId = null): void
    {
        preg_match_all('/@([\w.]+)/u', $content, $matches);
        if (empty($matches[1])) {
            return;
        }

        $names = array_unique($matches[1]);
        $mentioned = User::whereIn('name', $names)->orWhereIn('email', $names)->get();
        $actorId = Auth::id();

        foreach ($mentioned as $user) {
            Mention::create([
                'message_id'       => $messageId,
                'comment_id'       => $commentId,
                'mentioned_user_id'=> $user->id,
                'created_by'       => $actorId,
                'created_at'       => now(),
            ]);

            NotificationService::notify(
                $user,
                'mention',
                'Te mencionaron',
                (Auth::user()?->name ?? 'Alguien') . ' te mencionó en un mensaje.',
                [
                    'message_id' => $messageId,
                    'comment_id' => $commentId,
                ]
            );
        }
    }
}
