<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Channel extends Model
{
    protected $fillable = [
        'name', 'type', 'project_id', 'academic_program_id', 'is_archived', 'last_message_at',
    ];

    protected $casts = [
        'is_archived'     => 'boolean',
        'last_message_at' => 'datetime',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function program()
    {
        return $this->belongsTo(AcademicProgram::class, 'academic_program_id');
    }

    public function members()
    {
        return $this->belongsToMany(User::class, 'channel_members')
            ->withPivot('last_read_at');
    }

    public function messages()
    {
        return $this->hasMany(ChannelMessage::class);
    }
}
