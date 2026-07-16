<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            // 1. Migrar estados intermedios en role_activities a in_progress
            DB::table('role_activities')
                ->whereIn('status', [
                    'in_development',
                    'designing',
                    'production',
                    'implementing',
                    'draft',
                    'editing',
                    'adjusting',
                    'in_testing',
                    'validating',
                    'in_review'
                ])
                ->update(['status' => 'in_progress']);

            // 2. Desactivar estados de actividad redundantes en system_statuses
            DB::table('system_statuses')
                ->where('type', 'task')
                ->whereIn('slug', [
                    'in_development',
                    'designing',
                    'production',
                    'implementing',
                    'draft',
                    'editing',
                    'adjusting',
                    'in_testing',
                    'validating',
                    'in_review'
                ])
                ->update(['is_active' => false]);

            // 3. Asegurar que 'in_progress' exista y esté activo
            $exists = DB::table('system_statuses')
                ->where('type', 'task')
                ->where('slug', 'in_progress')
                ->exists();

            if (!$exists) {
                DB::table('system_statuses')->insert([
                    'type' => 'task',
                    'slug' => 'in_progress',
                    'label' => 'En Progreso',
                    'color' => '#194276',
                    'is_active' => true,
                    'is_manager_only' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('system_statuses')
                    ->where('type', 'task')
                    ->where('slug', 'in_progress')
                    ->update(['is_active' => true]);
            }
        });
    }

    public function down(): void
    {
        // No es necesario revertir ya que la simplificación es irreversible y destructiva por diseño.
    }
};
