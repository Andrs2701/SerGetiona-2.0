<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\SystemRole;

class SystemPermission extends Model
{
    use HasFactory;

    protected $table = 'system_permissions';

    protected $fillable = [
        'module',
        'action',
        'view_path',
        'allowed_roles',
        'description',
    ];

    protected $casts = [
        'allowed_roles' => 'array',
    ];

    public static function isAllowed(string $role, string $module, string $action): bool
    {
        // Check if role is active
        $roleRecord = SystemRole::where('slug', $role)->first();
        if ($roleRecord && !$roleRecord->is_active) {
            return false;
        }

        if ($role === 'admin') {
            return true;
        }

        $perm = self::where('module', $module)
            ->where('action', $action)
            ->first();

        if (!$perm) {
            return false;
        }

        return in_array($role, $perm->allowed_roles ?? [], true);
    }
}
