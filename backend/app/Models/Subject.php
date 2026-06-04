<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Subject extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'academic_program_id',
        'name',
        'code',
        'credits',
        'created_by',
    ];

    protected $casts = [
        'credits' => 'integer',
    ];

    public function academicProgram()
    {
        return $this->belongsTo(AcademicProgram::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function deliverables()
    {
        return $this->hasMany(Deliverable::class);
    }
}
