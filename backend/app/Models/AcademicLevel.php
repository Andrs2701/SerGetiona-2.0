<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AcademicLevel extends Model
{
    use HasFactory;
    protected $fillable = [
        'name',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
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
