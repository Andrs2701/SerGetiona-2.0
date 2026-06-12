<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Channel extends Model
{
    protected $fillable = [
        'name', 'type', 'project_id', 'academic_program_id', 'is_archived', 'is_private', 'last_message_at',
    ];

    protected $casts = [
        'is_archived'     => 'boolean',
        'is_private'      => 'boolean',
        'last_message_at' => 'datetime',
    ];

    /**
     * Un canal público es visible para todos; uno privado solo para sus
     * miembros y para quienes lo administran (admin/coordinator).
     */
    public function isVisibleTo(User $user): bool
    {
        if (!$this->is_private || in_array($user->role, ['admin', 'coordinator'], true)) {
            return true;
        }

        return $this->members()->where('user_id', $user->id)->exists();
    }

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
