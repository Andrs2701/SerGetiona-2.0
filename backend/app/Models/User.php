<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
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
        'position',
        'department',
        'photo_path',
        'weekly_capacity_points',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = [
        'photo_url',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    protected function photoUrl(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (!$this->photo_path) {
                    return null;
                }
                if (config('app.env') === 'production') {
                    return '/api/storage/' . $this->photo_path;
                }
                return Storage::disk('public')->url($this->photo_path);
            }
        );
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
