<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'phone',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function projects()
    {
        return $this->hasMany(Project::class, 'created_by');
    }

    public function responsibleProjects()
    {
        return $this->hasMany(Project::class, 'responsible_id');
    }

    public function roleActivities()
    {
        return $this->hasMany(RoleActivity::class, 'responsible_id');
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }
}
