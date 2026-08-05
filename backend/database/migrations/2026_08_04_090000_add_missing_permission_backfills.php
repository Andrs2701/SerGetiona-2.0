<?php

use App\Models\SystemPermission;
use Illuminate\Database\Migrations\Migration;

/**
 * Backfill de TODOS los permisos que hoy solo viven en SystemConfigSeeder
 * (usado solo en instalación inicial / `db:seed`). En cualquier entorno
 * donde ese seeder no se haya corrido (la suite de tests con
 * RefreshDatabase, un servidor nuevo provisionado solo con `migrate`) esas
 * filas no existen y la Matriz de Permisos queda sin efecto real para esos
 * módulos, aunque en la UI de Configuración se vean como si se pudieran
 * editar. Mismo patrón que 2026_08_03_120000 (firstOrCreate, allowed_roles
 * idénticos a lo que ya tenía el middleware antes de conectarse a la
 * Matriz), así que no cambia ningún acceso existente por sí solo.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permissions = [
            [
                'module' => 'projects',
                'action' => 'view',
                'view_path' => '/proyectos',
                // Solo admin/coordinator por defecto: el listado/menú de
                // "Escuelas / Proyectos" es una vista gerencial, no algo que
                // todo rol operativo deba ver de entrada — se otorga rol por
                // rol desde la Matriz si hace falta. No confundir con el
                // acceso de un rol operativo a SU proyecto asignado, que ya
                // funciona aparte vía ResourceAccess::canAccessProject() sin
                // depender de este permiso.
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Ver listado y detalles de proyectos.',
            ],
            [
                'module' => 'projects',
                'action' => 'manage',
                'view_path' => null,
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Crear, editar o eliminar proyectos.',
            ],
            [
                'module' => 'users',
                'action' => 'view',
                'view_path' => '/usuarios',
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Ver listado de usuarios.',
            ],
            [
                'module' => 'users',
                'action' => 'manage',
                'view_path' => null,
                'allowed_roles' => ['admin'],
                'description' => 'Crear, editar o desactivar usuarios.',
            ],
            [
                'module' => 'configuracion',
                'action' => 'view',
                'view_path' => '/configuracion',
                'allowed_roles' => ['admin'],
                'description' => 'Acceder a la configuración avanzada del sistema.',
            ],
            [
                'module' => 'reportes',
                'action' => 'view',
                'view_path' => '/reportes',
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Ver reportes gerenciales.',
            ],
            [
                'module' => 'colaboracion',
                'action' => 'manage_channels',
                'view_path' => null,
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Crear, eliminar o asignar usuarios a canales.',
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
        SystemPermission::where('module', 'projects')->whereIn('action', ['view', 'manage'])->delete();
        SystemPermission::where('module', 'users')->whereIn('action', ['view', 'manage'])->delete();
        SystemPermission::where('module', 'configuracion')->where('action', 'view')->delete();
        SystemPermission::where('module', 'reportes')->where('action', 'view')->delete();
        SystemPermission::where('module', 'colaboracion')->where('action', 'manage_channels')->delete();
    }
};
