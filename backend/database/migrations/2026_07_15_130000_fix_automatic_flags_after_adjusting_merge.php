<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Corrige el orden de dos migraciones previas.
 *
 * 2026_07_15_110000_backfill_automatic_role_statuses marca is_automatic donde
 * status_slug = 'adjustments_requested', pero corre ANTES de que
 * 2026_07_15_120000_eliminate_adjusting_status renombre las filas 'adjusting'
 * a 'adjustments_requested'. Esas filas renombradas nacían entonces con el
 * default is_automatic = false, dejando "Ajustes Solicitados" visible en el
 * selector de los roles que usaban 'adjusting' (pedagogy y design en local;
 * también audiovisual e ingeniería en el servidor). Verificado tras migrar en
 * local: expert quedaba en 1, pedagogy y design en 0.
 *
 * Re-aplicar el backfill aquí, después de la fusión, corrige esas filas. Es
 * idempotente: en un entorno donde las tres migraciones aún no han corrido,
 * esta simplemente reafirma valores ya correctos.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 'approved' lo asigna QA al aprobar, o la cascada a los hermanos:
        // automático para todos salvo QA, que sí lo elige desde su selector.
        DB::table('role_statuses')
            ->where('status_slug', 'approved')
            ->where('role', '!=', 'qa')
            ->update(['is_automatic' => true]);

        // 'adjustments_requested' siempre lo pone QA en los hermanos.
        DB::table('role_statuses')
            ->where('status_slug', 'adjustments_requested')
            ->update(['is_automatic' => true]);
    }

    /**
     * No revierte nada: 2026_07_15_110000 ya deja is_automatic en false para
     * todas las filas al revertirse. Duplicar ese barrido aquí solo borraría
     * los ajustes manuales del admin sin ganar nada.
     */
    public function down(): void
    {
        // no-op
    }
};
