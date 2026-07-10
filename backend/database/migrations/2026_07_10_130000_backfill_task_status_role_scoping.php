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

        // Mapeo de estados existentes con sus roles exactos
        $existingUpdates = [
            'not_started'           => ['allowed_roles' => $operationalRoles,    'is_manager_only' => false],
            'pending'               => ['allowed_roles' => ['qa'],               'is_manager_only' => false],
            'in_progress'           => ['allowed_roles' => ['pedagogy'],         'is_manager_only' => false],
            'in_review'             => ['allowed_roles' => ['pedagogy'],         'is_manager_only' => false],
            'delivered'             => ['allowed_roles' => $operationalRoles,    'is_manager_only' => false],
            'adjustments_requested' => ['allowed_roles' => ['expert'],           'is_manager_only' => false],
            'approved'              => ['allowed_roles' => $allProductionRoles, 'is_manager_only' => true],
            'not_applicable'        => ['allowed_roles' => $allProductionRoles, 'is_manager_only' => false],
        ];

        foreach ($existingUpdates as $slug => $data) {
            SystemStatus::where('type', 'task')
                ->where('slug', $slug)
                ->update([
                    'allowed_roles' => json_encode($data['allowed_roles']),
                    'is_manager_only' => $data['is_manager_only'],
                ]);
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
                    'allowed_roles' => json_encode($status['allowed_roles']),
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
