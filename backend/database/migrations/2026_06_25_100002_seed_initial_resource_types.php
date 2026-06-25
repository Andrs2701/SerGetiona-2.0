<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $types = [
            'expert'      => ['Multimedia', 'Descargable', 'Actividades evaluativas', 'Actividades formativas', 'Guiones'],
            'pedagogy'    => ['Multimedia', 'Descargable', 'Actividades evaluativas', 'Actividades formativas', 'Guiones'],
            'audiovisual' => ['Videos', 'Videos animados', 'Video podcast'],
            'design'      => ['Multimedia', 'Piezas gráficas', 'Banners', 'Línea gráfica'],
            'engineering' => ['Actividades evaluativas', 'Actividades formativas'],
        ];

        $now   = now();
        $order = 0;
        $rows  = [];

        foreach ($types as $role => $names) {
            foreach ($names as $name) {
                $rows[] = [
                    'role'       => $role,
                    'name'       => $name,
                    'slug'       => Str::slug($name),
                    'is_active'  => true,
                    'sort_order' => ++$order,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        foreach ($rows as $row) {
            DB::table('resource_types')->updateOrInsert(
                ['role' => $row['role'], 'slug' => $row['slug']],
                $row
            );
        }
    }

    public function down(): void
    {
        DB::table('resource_types')->whereIn('role', [
            'expert', 'pedagogy', 'audiovisual', 'design', 'engineering',
        ])->delete();
    }
};
