<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CapacitySnapshot extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'snapshot_date',
        'user_id',
        'role',
        'active_points',
        'active_activities',
        'capacity_points',
        'utilization_pct',
        'overdue_count',
        'created_at',
    ];

    protected $casts = [
        'snapshot_date'     => 'date',
        'active_points'     => 'float',
        'active_activities' => 'integer',
        'capacity_points'   => 'float',
        'utilization_pct'   => 'float',
        'overdue_count'     => 'integer',
        'created_at'        => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
