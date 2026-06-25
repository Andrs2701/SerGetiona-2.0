<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ResourceType extends Model
{
    use HasFactory;

    protected $fillable = [
        'role',
        'name',
        'slug',
        'description',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function productionLogs()
    {
        return $this->hasMany(ProductionLog::class);
    }
}
