<?php

namespace Database\Seeders;

use App\Models\ResourceType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ResourceTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            'expert' => ['Multimedia', 'Descargable', 'Actividades evaluativas', 'Actividades formativas', 'Guiones'],
            'pedagogy' => ['Multimedia', 'Descargable', 'Actividades evaluativas', 'Actividades formativas', 'Guiones'],
            'audiovisual' => ['Videos', 'Videos animados', 'Video podcast'],
            'design' => ['Multimedia', 'Piezas gráficas', 'Banners', 'Línea gráfica'],
            'engineering' => ['Actividades evaluativas', 'Actividades formativas'],
        ];

        $order = 0;
        foreach ($types as $role => $names) {
            foreach ($names as $name) {
                ResourceType::firstOrCreate(
                    ['role' => $role, 'slug' => Str::slug($name)],
                    [
                        'name' => $name,
                        'is_active' => true,
                        'sort_order' => ++$order,
                    ]
                );
            }
        }
    }
}
