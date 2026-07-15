<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::transaction(function () {
            // 1. En role_statuses, resolver el estado 'adjusting'
            $roleStatuses = DB::table('role_statuses')->where('status_slug', 'adjusting')->get();
            foreach ($roleStatuses as $rs) {
                $hasRequested = DB::table('role_statuses')
                    ->where('role', $rs->role)
                    ->where('status_slug', 'adjustments_requested')
                    ->exists();

                if ($hasRequested) {
                    // Si ya tiene adjustments_requested, simplemente borrar el duplicado adjusting
                    DB::table('role_statuses')->where('id', $rs->id)->delete();
                } else {
                    // Si no lo tiene, renombrar el adjusting a adjustments_requested
                    DB::table('role_statuses')
                        ->where('id', $rs->id)
                        ->update(['status_slug' => 'adjustments_requested']);
                }
            }

            // 2. Actualizar actividades en la tabla role_activities
            DB::table('role_activities')
                ->where('status', 'adjusting')
                ->update(['status' => 'adjustments_requested']);

            // 3. Eliminar transiciones de estado asociadas a 'adjusting'
            DB::table('state_transitions')
                ->where('from_status', 'adjusting')
                ->orWhere('to_status', 'adjusting')
                ->delete();

            // 4. Eliminar 'adjusting' del catálogo general de estados de sistema
            DB::table('system_statuses')
                ->where('type', 'task')
                ->where('slug', 'adjusting')
                ->delete();
        });
    }

    /**
     * Reverse the migrations.
     * Irreversible por naturaleza: no se puede distinguir qué actividades eran originalmente
     * 'adjusting' de las que ya eran 'adjustments_requested'. Recrea la entrada en el catálogo
     * para que no falle al revertir migraciones de desarrollo.
     */
    public function down(): void
    {
        DB::table('system_statuses')->insertOrIgnore([
            'type'            => 'task',
            'slug'            => 'adjusting',
            'label'           => 'En Ajustes',
            'color'           => 'bg-amber-400',
            'description'     => 'Se han solicitado ajustes o correcciones a la entrega del rol.',
            'is_active'       => true,
            'is_manager_only' => false,
            'allowed_roles'   => json_encode(['pedagogy', 'design']),
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);
    }
};
