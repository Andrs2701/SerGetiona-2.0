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

    /**
     * @deprecated Sin uso desde que "Estados por Rol" (tabla role_statuses) es la
     * fuente de verdad de qué estados ve y puede asignar cada rol. Se conserva
     * porque allowed_roles sigue siendo editable en la pantalla de catálogo, pero
     * no debe volver a usarse para filtrar ni validar: tener dos catálogos hacía
     * que el selector ofreciera opciones que al guardar daban 422.
     */
    public function isAvailableForRole(string $role): bool
    {
        if (is_null($this->allowed_roles)) {
            return true;
        }

        return in_array($role, $this->allowed_roles, true);
    }
}
