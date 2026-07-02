<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPreference extends Model
{
    protected $fillable = [
        'user_id',
        'portfolio_view',
        'right_sidebar_open',
        'email_notifications_enabled',
        'email_tasks',
        'email_chat',
        'email_deadlines',
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
