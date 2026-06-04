<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Evidence extends Model
{
    public $timestamps = false;
    const UPDATED_AT = null;

    protected $fillable = [
        'role_activity_id',
        'user_id',
        'filename',
        'original_name',
        'disk',
        'path',
        'mime_type',
        'version',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'version' => 'integer',
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
