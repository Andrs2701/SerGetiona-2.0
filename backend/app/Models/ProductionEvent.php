<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductionEvent extends Model
{
    protected $fillable = [
        'deliverable_id',
        'role_activity_id',
        'subject_id',
        'entity_type',
        'entity_id',
        'role',
        'user_id',
        'event_type',
        'from_state',
        'to_state',
        'reason_code',
        'payload',
        'ciclo',
        'occurred_at',
    ];

    protected $casts = [
        'payload'     => 'array',
        'occurred_at' => 'datetime',
    ];

    public function deliverable()
    {
        return $this->belongsTo(Deliverable::class);
    }

    public function roleActivity()
    {
        return $this->belongsTo(RoleActivity::class);
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
