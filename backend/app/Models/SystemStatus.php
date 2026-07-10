<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class SystemStatus extends Model
{
    use HasFactory;

    protected $table = 'system_statuses';

    protected $fillable = [
        'type',
        'slug',
        'label',
        'color',
        'description',
        'is_active',
        'allowed_roles',
        'is_manager_only',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'allowed_roles' => 'array',
        'is_manager_only' => 'boolean',
    ];

    public function isAvailableForRole(string $role): bool
    {
        if (is_null($this->allowed_roles)) {
            return true;
        }

        return in_array($role, $this->allowed_roles, true);
    }
}
