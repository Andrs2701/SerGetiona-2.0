<?php

namespace App\Services\Channels;

use App\Models\User;

/**
 * Canal de salida para resúmenes/alertas ejecutivas. Implementaciones
 * futuras (correo, Teams, Slack, WhatsApp) solo necesitan esta interfaz
 * y registrarse en ExecutiveSummaryService::$channels.
 */
interface NotificationChannelInterface
{
    public function key(): string;

    public function send(User $user, string $title, string $body, array $data = []): void;
}
