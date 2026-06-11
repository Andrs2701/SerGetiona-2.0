<?php

namespace App\Services\Channels;

use App\Models\User;
use App\Services\NotificationService;

class InternalChannel implements NotificationChannelInterface
{
    public function key(): string
    {
        return 'internal';
    }

    public function send(User $user, string $title, string $body, array $data = []): void
    {
        NotificationService::notify($user, 'executive_summary', $title, $body, $data);
    }
}
