<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Project extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'status',
        'responsible_id',
        'start_date',
        'end_date',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function responsible()
    {
        return $this->belongsTo(User::class, 'responsible_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function academicPrograms()
    {
        return $this->hasMany(AcademicProgram::class);
    }

    public function subjects()
    {
        return $this->hasManyThrough(Subject::class, AcademicProgram::class);
    }

    public function scopeActive($query)
    {
        return $query->whereNotIn('status', ['cancelled', 'finished']);
    }
}
