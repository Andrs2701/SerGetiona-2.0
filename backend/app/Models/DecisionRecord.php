<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DecisionRecord extends Model
{
    protected $fillable = [
        'decision_date',
        'project_id',
        'academic_program_id',
        'description',
        'responsible_id',
        'status',
        'impact',
        'observations',
        'created_by',
    ];

    protected $casts = [
        'decision_date' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function program()
    {
        return $this->belongsTo(AcademicProgram::class, 'academic_program_id');
    }

    public function responsible()
    {
        return $this->belongsTo(User::class, 'responsible_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
