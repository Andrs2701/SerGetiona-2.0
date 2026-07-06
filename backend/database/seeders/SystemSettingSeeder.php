<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class SystemSettingSeeder extends Seeder
{
    /**
     * Idempotente: no pisa valores ya ajustados por el administrador.
     */
    public function run(): void
    {
        $settings = [
            // Fórmula de salud de proyecto (pesos de penalización, % sobre 100)
            ['key' => 'health.weight_overdue',             'value' => '35', 'label' => 'Peso: actividades vencidas',         'group' => 'health'],
            ['key' => 'health.weight_deliverable_delay',   'value' => '25', 'label' => 'Peso: entregables atrasados',        'group' => 'health'],
            ['key' => 'health.weight_team_overload',       'value' => '20', 'label' => 'Peso: sobrecarga del equipo',        'group' => 'health'],
            ['key' => 'health.weight_schedule_deviation',  'value' => '20', 'label' => 'Peso: desviación de cronograma',     'group' => 'health'],
            ['key' => 'health.threshold_yellow',           'value' => '80', 'label' => 'Umbral verde→amarillo (score)',      'group' => 'health'],
            ['key' => 'health.threshold_red',              'value' => '60', 'label' => 'Umbral amarillo→rojo (score)',       'group' => 'health'],

            // Capacidad operativa
            ['key' => 'capacity.default_weekly_points',    'value' => '10',  'label' => 'Capacidad semanal por defecto (puntos)',   'group' => 'capacity'],
            ['key' => 'capacity.default_points',           'value' => '3',   'label' => 'Puntos por defecto (entregable sin nivel)', 'group' => 'capacity'],
            ['key' => 'capacity.threshold_high',           'value' => '80',  'label' => 'Umbral de ocupación alta (%)',             'group' => 'capacity'],
            ['key' => 'capacity.threshold_overload',       'value' => '100', 'label' => 'Umbral de sobrecarga (%)',                 'group' => 'capacity'],

            // Presencia
            ['key' => 'presence.online_threshold_minutes', 'value' => '5',   'label' => 'Minutos de inactividad antes de marcar "desconectado"', 'group' => 'presence'],
        ];

        foreach ($settings as $setting) {
            SystemSetting::firstOrCreate(
                ['key' => $setting['key']],
                ['value' => $setting['value'], 'label' => $setting['label'], 'group' => $setting['group']]
            );
        }
    }
}
