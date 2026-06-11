<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ComplexityLevel extends Model
{
    use HasFactory;
    protected $fillable = [
        'name',
        'points',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'points'    => 'integer',
        'is_active' => 'boolean',
    ];

    public function deliverables()
    {
        return $this->hasMany(Deliverable::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
