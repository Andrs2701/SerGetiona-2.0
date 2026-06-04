<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RoleActivity extends Model
{
    use HasFactory;

    protected $fillable = [
        'deliverable_id',
        'role',
        'responsible_id',
        'assigned_by',
        'assigned_at',
        'commitment_date',
        'actual_start_date',
        'actual_delivery_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'commitment_date' => 'date',
        'actual_start_date' => 'date',
        'actual_delivery_date' => 'date',
    ];

    public function deliverable()
    {
        return $this->belongsTo(Deliverable::class);
    }

    public function responsible()
    {
        return $this->belongsTo(User::class, 'responsible_id');
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function evidences()
    {
        return $this->hasMany(Evidence::class);
    }
}
