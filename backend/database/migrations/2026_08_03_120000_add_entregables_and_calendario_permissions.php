<?php

use App\Models\SystemPermission;
use Illuminate\Database\Migrations\Migration;

/**
 * Backfill de permisos para módulos que ya existían en el código (Entregables,
 * "Ver Todas" del Calendario) pero nunca tuvieron fila en system_permissions —
 * sin esto, la Matriz de Permisos no puede controlar el acceso a ellos. Los
 * allowed_roles por defecto son idénticos a la restricción fija que tenían
 * antes (admin+coordinator), así que este backfill no cambia ningún acceso
 * existente por sí solo — solo lo hace configurable desde Configuración.
 *
 * firstOrCreate por fila (no insertOrIgnore) para que siga siendo seguro de
 * re-correr y coherente con SystemConfigSeeder, que usa el mismo patrón.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permissions = [
            [
                'module' => 'entregables',
                'action' => 'view',
                'view_path' => '/entregables',
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Mostrar el enlace de Entregables en el menú (el acceso a los datos ya está abierto a todo usuario autenticado, filtrado por su propio alcance).',
            ],
            [
                'module' => 'entregables',
                'action' => 'manage',
                'view_path' => null,
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Crear, editar o eliminar entregables.',
            ],
            [
                'module' => 'calendario',
                'action' => 'view_all',
                'view_path' => null,
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Ver en el Calendario las entregas de todo el equipo, no solo las propias.',
            ],
        ];

        foreach ($permissions as $p) {
            SystemPermission::firstOrCreate(
                ['module' => $p['module'], 'action' => $p['action']],
                $p
            );
        }
    }

    public function down(): void
    {
        SystemPermission::where('module', 'entregables')->whereIn('action', ['view', 'manage'])->delete();
        SystemPermission::where('module', 'calendario')->where('action', 'view_all')->delete();
    }
};
