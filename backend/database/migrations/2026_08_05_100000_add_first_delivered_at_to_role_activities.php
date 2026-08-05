<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * "first_delivered_at" guarda la PRIMERA fecha en que el responsable
 * entregó, y nunca se sobreescribe — a diferencia de actual_delivery_date,
 * que representa la entrega MÁS RECIENTE (y hasta ahora se borraba) en
 * cada ciclo de revisión con hallazgos. Sin esto, al devolver una
 * actividad para ajustes, la fecha original de entrega desaparecía de
 * toda la interfaz — solo quedaba en el historial de auditoría.
 *
 * El backfill busca en audit_logs el registro más antiguo de
 * actual_delivery_date por actividad; si no hay historial (actividades
 * muy antiguas sin auditoría), usa el valor actual como aproximación.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('role_activities', function (Blueprint $table) {
            $table->date('first_delivered_at')->nullable()->after('actual_delivery_date');
        });

        DB::table('role_activities')
            ->whereNotNull('actual_delivery_date')
            ->orderBy('id')
            ->select('id', 'actual_delivery_date')
            ->chunkById(500, function ($activities) {
                foreach ($activities as $activity) {
                    $earliest = DB::table('audit_logs')
                        ->where('entity_type', 'RoleActivity')
                        ->where('entity_id', $activity->id)
                        ->where('field_changed', 'actual_delivery_date')
                        ->whereNotNull('new_value')
                        ->orderBy('created_at')
                        ->orderBy('id')
                        ->value('new_value');

                    $firstDeliveredAt = $earliest ? substr($earliest, 0, 10) : $activity->actual_delivery_date;

                    DB::table('role_activities')
                        ->where('id', $activity->id)
                        ->update(['first_delivered_at' => $firstDeliveredAt]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('role_activities', function (Blueprint $table) {
            $table->dropColumn('first_delivered_at');
        });
    }
};
