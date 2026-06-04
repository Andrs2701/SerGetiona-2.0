<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    public static function notify(User|int $user, string $type, string $title, string $message, array $data = []): void
    {
        if (is_int($user)) {
            $user = User::find($user);
        }

        if (!$user) {
            return;
        }

        Notification::create([
            'user_id'    => $user->id,
            'type'       => $type,
            'title'      => $title,
            'message'    => $message,
            'data'       => $data,
            'created_at' => now(),
        ]);

        Log::info("EMAIL: {$title} -> {$user->email} | {$message}");
    }

    public static function notifyMany(Collection $users, string $type, string $title, string $message, array $data = []): void
    {
        foreach ($users as $user) {
            static::notify($user, $type, $title, $message, $data);
        }
    }
}
