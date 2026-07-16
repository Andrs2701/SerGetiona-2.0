<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RoleActivityObservation extends Model
{
    use HasFactory;

    protected $table = 'role_activity_observations';

    protected $fillable = [
        'role_activity_id',
        'user_id',
        'observation',
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
