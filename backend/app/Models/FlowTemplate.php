<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FlowTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'is_default',
        'offsets',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'offsets' => 'array',
    ];
}
