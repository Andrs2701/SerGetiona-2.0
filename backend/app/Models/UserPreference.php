<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPreference extends Model
{
    /**
     * Única fuente de verdad para los valores por defecto de un usuario sin
     * preferencias guardadas — evita que PreferenceController y
     * NotificationService diverjan entre sí (ya pasó una vez).
     */
    public const DEFAULT_PREFERENCES = [
        'portfolio_view' => 'table',
        'right_sidebar_open' => true,
        'email_notifications_enabled' => true,
        'email_tasks' => true,
        'email_chat' => false,
        'email_deadlines' => false,
        'entregables_view' => 'rows',
    ];

    protected $fillable = [
        'user_id',
        'portfolio_view',
        'right_sidebar_open',
        'email_notifications_enabled',
        'email_tasks',
        'email_chat',
        'email_deadlines',
        'entregables_view',
    ];

    protected $casts = [
        'right_sidebar_open' => 'boolean',
        'email_notifications_enabled' => 'boolean',
        'email_tasks' => 'boolean',
        'email_chat' => 'boolean',
        'email_deadlines' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
