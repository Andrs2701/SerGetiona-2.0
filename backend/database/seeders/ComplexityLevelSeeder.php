<?php

namespace Database\Seeders;

use App\Models\ComplexityLevel;
use Illuminate\Database\Seeder;

class ComplexityLevelSeeder extends Seeder
{
    /**
     * Idempotente: seguro de re-ejecutar sobre BD poblada.
     * No pisa los puntos si el admin ya los modificó.
     */
    public function run(): void
    {
        $levels = [
            ['name' => 'Baja',    'points' => 1, 'sort_order' => 1],
            ['name' => 'Media',   'points' => 3, 'sort_order' => 2],
            ['name' => 'Alta',    'points' => 5, 'sort_order' => 3],
            ['name' => 'Crítica', 'points' => 8, 'sort_order' => 4],
        ];

        foreach ($levels as $level) {
            ComplexityLevel::firstOrCreate(
                ['name' => $level['name']],
                ['points' => $level['points'], 'sort_order' => $level['sort_order'], 'is_active' => true]
            );
        }
    }
}
