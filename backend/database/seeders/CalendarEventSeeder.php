<?php

namespace Database\Seeders;

use App\Models\CalendarEvent;
use Illuminate\Database\Seeder;

class CalendarEventSeeder extends Seeder
{
    public function run(): void
    {
        // Festivos extraídos directamente del Excel Bd_Calendario / hoja Calendario
        $holidays = [
            // 2025
            ['name' => 'Año Nuevo',                  'date' => '2025-01-01'],
            ['name' => 'Día de los Reyes Magos',     'date' => '2025-01-06'],
            ['name' => 'Día de San José',             'date' => '2025-03-24'],
            ['name' => 'Jueves Santo',                'date' => '2025-04-17'],
            ['name' => 'Viernes Santo',               'date' => '2025-04-18'],
            ['name' => 'Día del Trabajo',             'date' => '2025-05-01'],
            ['name' => 'Día de la Ascensión',         'date' => '2025-06-02'],
            ['name' => 'Corpus Christi',              'date' => '2025-06-23'],
            ['name' => 'Sagrado Corazón',             'date' => '2025-06-30'],
            ['name' => 'Día de la Independencia',     'date' => '2025-07-20'],
            ['name' => 'Batalla de Boyacá',           'date' => '2025-08-07'],
            ['name' => 'La Asunción de la Virgen',    'date' => '2025-08-18'],
            ['name' => 'Día de la Raza',              'date' => '2025-10-12'],
            ['name' => 'Todos los Santos',            'date' => '2025-11-02'],
            ['name' => 'Independencia de Cartagena',  'date' => '2025-11-16'],
            ['name' => 'Inmaculada Concepción',       'date' => '2025-12-08'],
            ['name' => 'Navidad',                     'date' => '2025-12-25'],
            // 2026
            ['name' => 'Año Nuevo',                  'date' => '2026-01-01'],
            ['name' => 'Día de los Reyes Magos',     'date' => '2026-01-06'],
            ['name' => 'Día de San José',             'date' => '2026-03-23'],
            ['name' => 'Jueves Santo',                'date' => '2026-04-02'],
            ['name' => 'Viernes Santo',               'date' => '2026-04-03'],
            ['name' => 'Día del Trabajo',             'date' => '2026-05-01'],
            ['name' => 'Día de la Ascensión',         'date' => '2026-05-18'],
            ['name' => 'Corpus Christi',              'date' => '2026-06-08'],
            ['name' => 'Sagrado Corazón',             'date' => '2026-06-15'],
            ['name' => 'Día de la Independencia',     'date' => '2026-07-20'],
            ['name' => 'Batalla de Boyacá',           'date' => '2026-08-07'],
            ['name' => 'La Asunción de la Virgen',    'date' => '2026-08-17'],
            ['name' => 'Día de la Raza',              'date' => '2026-10-12'],
            ['name' => 'Todos los Santos',            'date' => '2026-11-02'],
            ['name' => 'Independencia de Cartagena',  'date' => '2026-11-16'],
            ['name' => 'Inmaculada Concepción',       'date' => '2026-12-08'],
            ['name' => 'Navidad',                     'date' => '2026-12-25'],
            // 2027
            ['name' => 'Año Nuevo',                  'date' => '2027-01-01'],
            ['name' => 'Día de los Reyes Magos',     'date' => '2027-01-11'],
            ['name' => 'Día de San José',             'date' => '2027-03-22'],
            ['name' => 'Jueves Santo',                'date' => '2027-03-25'],
            ['name' => 'Viernes Santo',               'date' => '2027-03-26'],
            ['name' => 'Día del Trabajo',             'date' => '2027-05-01'],
            ['name' => 'Día de la Ascensión',         'date' => '2027-05-10'],
            ['name' => 'Corpus Christi',              'date' => '2027-05-31'],
            ['name' => 'Sagrado Corazón',             'date' => '2027-06-07'],
            ['name' => 'San Pedro y San Pablo',       'date' => '2027-07-05'],
            ['name' => 'Día de la Independencia',     'date' => '2027-07-20'],
            ['name' => 'Batalla de Boyacá',           'date' => '2027-08-07'],
            ['name' => 'La Asunción de la Virgen',    'date' => '2027-08-16'],
            ['name' => 'Día de la Raza',              'date' => '2027-10-12'],
            ['name' => 'Todos los Santos',            'date' => '2027-11-01'],
            ['name' => 'Independencia de Cartagena',  'date' => '2027-11-15'],
            ['name' => 'Inmaculada Concepción',       'date' => '2027-12-08'],
            ['name' => 'Navidad',                     'date' => '2027-12-25'],
        ];

        foreach ($holidays as $h) {
            CalendarEvent::updateOrCreate(
                ['date' => $h['date'], 'name' => $h['name']],
                ['type' => 'holiday', 'is_recurring' => false, 'description' => 'Festivo nacional Colombia']
            );
        }

        $this->command->info('CalendarEventSeeder: ' . count($holidays) . ' festivos Colombia 2025-2027 creados.');
    }
}
