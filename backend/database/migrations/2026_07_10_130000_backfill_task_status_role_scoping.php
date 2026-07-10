<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\SystemStatus;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Definir los roles y mapeos exactos basados en el catálogo original
        $allProductionRoles = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];
        $operationalRoles = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering'];

        // Mapeo de estados existentes con sus roles exactos.
        // Verificado contra los datos reales de role_activities: not_started e
        // in_progress se ensanchan porque QA (34 registros) y Design (2 registros)
        // los usan hoy en producción, aunque el catálogo original no los listara ahí.
        // adjustments_requested se deja abierto a todos los roles operativos como
        // margen de seguridad, ya que es un estado genérico de "devuelto para ajustes"
        // (agrupado junto con with_findings en WorkspaceController::STATUS_RETURNED)
        // y no hay evidencia suficiente para restringirlo solo a expert sin arriesgar
        // bloquear actividades reales de otros roles.
        //
        // Se usa updateOrCreate (no update) porque estas filas base las siembra
        // SystemConfigSeeder, no una migración — en un entorno donde ese seeder
        // no se haya corrido (p. ej. tests con RefreshDatabase), un update() sobre
        // una fila inexistente no hace nada y deja el estado sin fila, causando que
        // CUALQUIER cambio de estado sea rechazado con 422. Los labels/colores son
        // los mismos que ya usa SystemConfigSeeder, para no crear una fila distinta
        // a la que el seeder crearía.
        $existingUpdates = [
            'not_started'           => ['label' => 'Sin Iniciar', 'color' => 'bg-gray-200', 'description' => 'Actividad aún no iniciada.', 'allowed_roles' => $allProductionRoles, 'is_manager_only' => false],
            'pending'               => ['label' => 'Pendiente', 'color' => 'bg-gray-300', 'description' => 'Pendiente de inicio.', 'allowed_roles' => ['qa'], 'is_manager_only' => false],
            'in_progress'           => ['label' => 'En Progreso', 'color' => 'bg-blue-400', 'description' => 'En desarrollo.', 'allowed_roles' => ['pedagogy', 'design'], 'is_manager_only' => false],
            'in_review'             => ['label' => 'En Revisión', 'color' => 'bg-purple-400', 'description' => 'Bajo revisión.', 'allowed_roles' => ['pedagogy'], 'is_manager_only' => false],
            'delivered'             => ['label' => 'Entregado', 'color' => 'bg-teal-500', 'description' => 'Entregado por el responsable.', 'allowed_roles' => $operationalRoles, 'is_manager_only' => false],
            'adjustments_requested' => ['label' => 'Ajustes Solicitados', 'color' => 'bg-orange-400', 'description' => 'Devuelto para ajustes.', 'allowed_roles' => $operationalRoles, 'is_manager_only' => false],
            'approved'              => ['label' => 'Aprobado', 'color' => 'bg-emerald-500', 'description' => 'Aprobado y finalizado.', 'allowed_roles' => $allProductionRoles, 'is_manager_only' => true],
            'not_applicable'        => ['label' => 'No Aplica', 'color' => 'bg-gray-100', 'description' => 'No aplica para esta actividad.', 'allowed_roles' => $allProductionRoles, 'is_manager_only' => false],
        ];

        // OJO: NO usar json_encode() aquí — SystemStatus::$casts ya castea
        // allowed_roles como 'array', así que Eloquent codifica/decodifica solo.
        // Pasar un string ya codificado produce doble-encoding: la columna queda
        // con un JSON string escapado dentro de otro string, y isAvailableForRole()
        // revienta con TypeError al intentar in_array() sobre un string.
        foreach ($existingUpdates as $slug => $data) {
            SystemStatus::updateOrCreate(
                ['type' => 'task', 'slug' => $slug],
                [
                    'label'           => $data['label'],
                    'color'           => $data['color'],
                    'description'     => $data['description'],
                    'is_active'       => true,
                    'allowed_roles'   => $data['allowed_roles'],
                    'is_manager_only' => $data['is_manager_only'],
                ]
            );
        }

        // 2. Crear los estados específicos adicionales con sus roles exactos
        $newStatuses = [
            [
                'slug' => 'draft',
                'label' => 'Borrador',
                'color' => 'bg-blue-400',
                'description' => 'Borrador inicial del recurso.',
                'allowed_roles' => ['expert'],
            ],
            [
                'slug' => 'in_development',
                'label' => 'En Desarrollo',
                'color' => 'bg-blue-400',
                'description' => 'Contenido en proceso de desarrollo.',
                'allowed_roles' => ['expert', 'pedagogy'],
            ],
            [
                'slug' => 'designing',
                'label' => 'Diseñando',
                'color' => 'bg-blue-400',
                'description' => 'Recursos gráficos en diseño.',
                'allowed_roles' => ['design'],
            ],
            [
                'slug' => 'production',
                'label' => 'Producción',
                'color' => 'bg-blue-400',
                'description' => 'Grabación o producción audiovisual.',
                'allowed_roles' => ['audiovisual'],
            ],
            [
                'slug' => 'editing',
                'label' => 'Edición',
                'color' => 'bg-blue-400',
                'description' => 'Edición de recursos audiovisuales.',
                'allowed_roles' => ['audiovisual'],
            ],
            [
                'slug' => 'implementing',
                'label' => 'Implementando',
                'color' => 'bg-blue-400',
                'description' => 'Montaje e implementación en plataforma.',
                'allowed_roles' => ['engineering'],
            ],
            [
                'slug' => 'validating',
                'label' => 'Validando',
                'color' => 'bg-blue-400',
                'description' => 'Validación técnica en la plataforma.',
                'allowed_roles' => ['engineering'],
            ],
            [
                'slug' => 'in_testing',
                'label' => 'En Pruebas',
                'color' => 'bg-purple-400',
                'description' => 'Bajo pruebas de calidad final.',
                'allowed_roles' => ['qa'],
            ],
            [
                'slug' => 'with_findings',
                'label' => 'Con Hallazgos',
                'color' => 'bg-orange-400',
                'description' => 'Se detectaron observaciones en calidad.',
                'allowed_roles' => ['qa'],
            ],
            [
                'slug' => 'adjusting',
                'label' => 'En Ajustes',
                'color' => 'bg-orange-400',
                'description' => 'Corrección de observaciones de calidad.',
                'allowed_roles' => ['pedagogy', 'design'],
            ],
        ];

        foreach ($newStatuses as $status) {
            SystemStatus::firstOrCreate(
                ['type' => 'task', 'slug' => $status['slug']],
                [
                    'label' => $status['label'],
                    'color' => $status['color'],
                    'description' => $status['description'],
                    'allowed_roles' => $status['allowed_roles'],
                    'is_manager_only' => false,
                    'is_active' => true,
                ]
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revertir actualizaciones a nulo
        SystemStatus::where('type', 'task')->update([
            'allowed_roles' => null,
            'is_manager_only' => false,
        ]);

        // Eliminar los nuevos estados
        $newSlugs = [
            'draft', 'in_development', 'designing', 'production', 'editing',
            'implementing', 'validating', 'in_testing', 'with_findings', 'adjusting'
        ];
        SystemStatus::where('type', 'task')->whereIn('slug', $newSlugs)->delete();
    }
};
