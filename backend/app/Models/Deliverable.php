<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Deliverable extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'subject_id',
        'name',
        'type',
        'global_status',
        'start_date',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
    ];

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function roleActivities()
    {
        return $this->hasMany(RoleActivity::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('global_status', $status);
    }
}
