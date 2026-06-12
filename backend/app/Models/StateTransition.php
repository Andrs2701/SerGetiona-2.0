<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StateTransition extends Model
{
    use HasFactory;

    protected $table = 'state_transitions';

    protected $fillable = [
        'type',
        'from_status',
        'to_status',
        'allowed_roles',
    ];

    protected $casts = [
        'allowed_roles' => 'array',
    ];
}
