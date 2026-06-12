<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class SystemStatus extends Model
{
    use HasFactory;

    protected $table = 'system_statuses';

    protected $fillable = [
        'type',
        'slug',
        'label',
        'color',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
