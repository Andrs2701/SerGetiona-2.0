<?php

namespace Database\Seeders;

use App\Models\SystemRole;
use App\Models\SystemPermission;
use App\Models\SystemStatus;
use App\Models\StateTransition;
use App\Models\VisibilityRule;
use Illuminate\Database\Seeder;

class SystemConfigSeeder extends Seeder
{
    /**
     * Idempotente por diseño: usa firstOrCreate en vez de updateOrCreate,
     * es decir solo crea lo que falte y nunca pisa filas existentes.
     * Necesario porque roles/permisos/estados son editables desde
     * Configuración: un re-run accidental no debe revertir cambios de un admin.
     */
    public function run(): void
    {
        // 1. Roles
        $roles = [
            ['slug' => 'admin', 'name' => 'Administrador', 'description' => 'Acceso total y configuración del sistema.'],
            ['slug' => 'coordinator', 'name' => 'Coordinador', 'description' => 'Gestión operativa, asignaciones e informes.'],
            ['slug' => 'expert', 'name' => 'Experto Temático', 'description' => 'Creación y entrega de contenido académico.'],
            ['slug' => 'pedagogy', 'name' => 'Pedagogía', 'description' => 'Validación instruccional y pedagógica.'],
            ['slug' => 'design', 'name' => 'Diseño', 'description' => 'Creación de recursos gráficos.'],
            ['slug' => 'audiovisual', 'name' => 'Audiovisual', 'description' => 'Producción de audio y video.'],
            ['slug' => 'engineering', 'name' => 'Ingeniería', 'description' => 'Integración e implementación en plataforma.'],
            ['slug' => 'qa', 'name' => 'Calidad', 'description' => 'Control de calidad final.'],
        ];

        foreach ($roles as $r) {
            SystemRole::firstOrCreate(['slug' => $r['slug']], $r);
        }

        // 2. Permissions
        $permissions = [
            [
                'module' => 'projects',
                'action' => 'view',
                'view_path' => '/proyectos',
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Ver listado y detalles de proyectos.'
            ],
            [
                'module' => 'projects',
                'action' => 'manage',
                'view_path' => null,
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Crear, editar o eliminar proyectos.'
            ],
            [
                'module' => 'users',
                'action' => 'view',
                'view_path' => '/usuarios',
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Ver listado de usuarios.'
            ],
            [
                'module' => 'users',
                'action' => 'manage',
                'view_path' => null,
                'allowed_roles' => ['admin'],
                'description' => 'Crear, editar o desactivar usuarios.'
            ],
            [
                'module' => 'configuracion',
                'action' => 'view',
                'view_path' => '/configuracion',
                'allowed_roles' => ['admin'],
                'description' => 'Acceder a la configuración avanzada del sistema.'
            ],
            [
                'module' => 'reportes',
                'action' => 'view',
                'view_path' => '/reportes',
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Ver reportes gerenciales.'
            ],
            [
                'module' => 'colaboracion',
                'action' => 'manage_channels',
                'view_path' => null,
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Crear, eliminar o asignar usuarios a canales.'
            ],
            [
                'module' => 'entregables',
                'action' => 'view',
                'view_path' => '/entregables',
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Mostrar el enlace de Entregables en el menú (el acceso a los datos ya está abierto a todo usuario autenticado, filtrado por su propio alcance).'
            ],
            [
                'module' => 'entregables',
                'action' => 'manage',
                'view_path' => null,
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Crear, editar o eliminar entregables.'
            ],
            [
                'module' => 'calendario',
                'action' => 'view_all',
                'view_path' => null,
                'allowed_roles' => ['admin', 'coordinator'],
                'description' => 'Ver en el Calendario las entregas de todo el equipo, no solo las propias.'
            ],
        ];

        foreach ($permissions as $p) {
            SystemPermission::firstOrCreate(
                ['module' => $p['module'], 'action' => $p['action']],
                $p
            );
        }

        // 3. Statuses
        $statuses = [
            // Deliverable Statuses
            ['type' => 'deliverable', 'slug' => 'unpublished', 'label' => 'Sin Publicar', 'color' => 'bg-gray-200', 'description' => 'El entregable no se ha publicado.'],
            ['type' => 'deliverable', 'slug' => 'pending_start', 'label' => 'Pendiente Inicio', 'color' => 'bg-amber-400', 'description' => 'Listo para iniciar.'],
            ['type' => 'deliverable', 'slug' => 'in_progress', 'label' => 'En Ejecución', 'color' => 'bg-blue-500', 'description' => 'En proceso de producción.'],
            ['type' => 'deliverable', 'slug' => 'in_review', 'label' => 'En Revisión', 'color' => 'bg-purple-500', 'description' => 'Bajo revisión de calidad.'],
            ['type' => 'deliverable', 'slug' => 'with_observations', 'label' => 'Con Observaciones', 'color' => 'bg-orange-500', 'description' => 'Con hallazgos por corregir.'],
            ['type' => 'deliverable', 'slug' => 'finished', 'label' => 'Finalizado', 'color' => 'bg-emerald-500', 'description' => 'Completado con éxito.'],
            ['type' => 'deliverable', 'slug' => 'cancelled', 'label' => 'Cancelado', 'color' => 'bg-red-500', 'description' => 'Cancelado.'],
            ['type' => 'deliverable', 'slug' => 'not_applicable', 'label' => 'No Aplica', 'color' => 'bg-gray-100', 'description' => 'No aplica para este entregable.'],

            // Task/Activity Statuses
            ['type' => 'task', 'slug' => 'not_started', 'label' => 'Sin Iniciar', 'color' => 'bg-gray-200', 'description' => 'Actividad aún no iniciada.'],
            ['type' => 'task', 'slug' => 'pending', 'label' => 'Pendiente', 'color' => 'bg-gray-300', 'description' => 'Pendiente de inicio.'],
            ['type' => 'task', 'slug' => 'in_progress', 'label' => 'En Progreso', 'color' => 'bg-blue-400', 'description' => 'En desarrollo.'],
            ['type' => 'task', 'slug' => 'in_review', 'label' => 'En Revisión', 'color' => 'bg-purple-400', 'description' => 'Bajo revisión.'],
            ['type' => 'task', 'slug' => 'delivered', 'label' => 'Entregado', 'color' => 'bg-teal-500', 'description' => 'Entregado por el responsable.'],
            ['type' => 'task', 'slug' => 'adjustments_requested', 'label' => 'Ajustes Solicitados', 'color' => 'bg-orange-400', 'description' => 'Devuelto para ajustes.'],
            ['type' => 'task', 'slug' => 'approved', 'label' => 'Aprobado', 'color' => 'bg-emerald-500', 'description' => 'Aprobado y finalizado.'],
            ['type' => 'task', 'slug' => 'not_applicable', 'label' => 'No Aplica', 'color' => 'bg-gray-100', 'description' => 'No aplica para esta actividad.'],
        ];

        foreach ($statuses as $s) {
            SystemStatus::firstOrCreate(
                ['type' => $s['type'], 'slug' => $s['slug']],
                $s
            );
        }

        // 4. State Transitions
        $transitions = [
            // Task Transitions
            ['type' => 'task', 'from_status' => 'not_started', 'to_status' => 'in_progress', 'allowed_roles' => ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']],
            ['type' => 'task', 'from_status' => 'pending', 'to_status' => 'in_progress', 'allowed_roles' => ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']],
            ['type' => 'task', 'from_status' => 'in_progress', 'to_status' => 'delivered', 'allowed_roles' => ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']],
            ['type' => 'task', 'from_status' => 'delivered', 'to_status' => 'approved', 'allowed_roles' => ['admin', 'coordinator', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']],
            ['type' => 'task', 'from_status' => 'delivered', 'to_status' => 'adjustments_requested', 'allowed_roles' => ['admin', 'coordinator', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']],
            ['type' => 'task', 'from_status' => 'adjustments_requested', 'to_status' => 'in_progress', 'allowed_roles' => ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']],
        ];

        foreach ($transitions as $t) {
            StateTransition::firstOrCreate(
                ['type' => $t['type'], 'from_status' => $t['from_status'], 'to_status' => $t['to_status']],
                $t
            );
        }

        // 5. Visibility Rules
        $visibility = [
            ['role_slug' => 'admin', 'scope' => 'all'],
            ['role_slug' => 'coordinator', 'scope' => 'all'],
            ['role_slug' => 'expert', 'scope' => 'assigned_only'],
            ['role_slug' => 'pedagogy', 'scope' => 'assigned_only'],
            ['role_slug' => 'design', 'scope' => 'assigned_only'],
            ['role_slug' => 'audiovisual', 'scope' => 'assigned_only'],
            ['role_slug' => 'engineering', 'scope' => 'assigned_only'],
            ['role_slug' => 'qa', 'scope' => 'assigned_only'],
        ];

        foreach ($visibility as $v) {
            VisibilityRule::firstOrCreate(
                ['role_slug' => $v['role_slug']],
                $v
            );
        }
    }
}
