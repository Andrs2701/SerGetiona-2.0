<?php

use App\Models\RoleActivity;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Limpieza de datos: RoleActivity no usa SoftDeletes, así que cada
 * DeliverableController::destroy() anterior a este fix dejó sus
 * actividades como filas reales huérfanas (deliverable_id apuntando a un
 * entregable ya soft-deleted). Esas filas seguían contando como
 * "vencidas" en cualquier consulta de reportes que no filtrara
 * explícitamente whereHas('deliverable') — caso reportado: un usuario sin
 * entregas visibles seguía apareciendo con actividades vencidas en
 * Distribución de Carga / Cumplimiento.
 *
 * Es una limpieza de datos, no de esquema — no hay "down" que la revierta
 * (las filas eliminadas aquí ya eran huérfanas inaccesibles desde la app).
 */
return new class extends Migration
{
    public function up(): void
    {
        $orphanIds = DB::table('role_activities')
            ->leftJoin('deliverables', 'role_activities.deliverable_id', '=', 'deliverables.id')
            ->where(function ($q) {
                $q->whereNull('deliverables.id')
                    ->orWhereNotNull('deliverables.deleted_at');
            })
            ->pluck('role_activities.id');

        if ($orphanIds->isNotEmpty()) {
            // Eloquent (no DB::table) para que el modelo dispare el DELETE
            // real que sí activa el cascadeOnDelete() de sus hijos
            // (evidence_links, production_logs, role_activity_observations).
            RoleActivity::whereIn('id', $orphanIds)->delete();
        }
    }

    public function down(): void
    {
        // Limpieza de datos irreversible por diseño — ver docblock arriba.
    }
};
