<?php

use App\Models\SystemPermission;
use Illuminate\Database\Migrations\Migration;

/**
 * Backfill de permisos "projects.view"/"projects.manage": ya existían en
 * SystemConfigSeeder (usado solo en instalación inicial / `db:seed`), pero
 * nunca tuvieron migración propia — en cualquier entorno donde ese seeder no
 * se haya corrido (por ejemplo, la suite de tests con RefreshDatabase) la
 * fila no existe, y la ruta "Proyectos · Gestionar" queda inaccesible incluso
 * para coordinator pese a que sí figura como allowed_role. Mismo patrón que
 * 2026_08_03_120000 (firstOrCreate, allowed_roles idénticos a lo que ya tenía
 * el middleware antes: admin+coordinator), así que no cambia ningún acceso
 * existente por sí solo.
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
                'allowed_roles' => ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'],
                'description' => 'Ver listado y detalles de proyectos.',
            ],
            [
                'module' => 'projects',
                'action' => 'manage',
                'view_path' => null,
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Crear, editar o eliminar proyectos.',
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
    }
};
