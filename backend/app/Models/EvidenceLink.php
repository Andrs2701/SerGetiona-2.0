<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EvidenceLink extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'role_activity_id',
        'user_id',
        'type',
        'title',
        'url',
        'filename',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function roleActivity()
    {
        return $this->belongsTo(RoleActivity::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
