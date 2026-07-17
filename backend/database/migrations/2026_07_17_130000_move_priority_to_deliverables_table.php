<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add priority column to deliverables
        Schema::table('deliverables', function (Blueprint $table) {
            $table->string('priority')->default('media');
        });

        // 2. Perform backfill migration of priority from role_activities to deliverables
        $deliverableIds = DB::table('role_activities')
            ->whereIn('priority', ['alta', 'baja'])
            ->pluck('deliverable_id')
            ->unique();

        foreach ($deliverableIds as $dId) {
            $activities = DB::table('role_activities')
                ->where('deliverable_id', $dId)
                ->get();

            $hasAlta = $activities->contains('priority', 'alta');
            $hasBaja = $activities->contains('priority', 'baja');

            if ($hasAlta) {
                $priority = 'alta';
            } elseif ($hasBaja) {
                $priority = 'baja';
            } else {
                $priority = 'media';
            }

            DB::table('deliverables')
                ->where('id', $dId)
                ->update(['priority' => $priority]);
        }

        // 3. Drop priority column from role_activities
        Schema::table('role_activities', function (Blueprint $table) {
            $table->dropColumn('priority');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 1. Re-add priority column to role_activities
        Schema::table('role_activities', function (Blueprint $table) {
            $table->string('priority')->default('media');
        });

        // 2. Propagate back the priority from deliverables to their role_activities
        $deliverables = DB::table('deliverables')
            ->whereIn('priority', ['alta', 'baja'])
            ->get();

        foreach ($deliverables as $d) {
            DB::table('role_activities')
                ->where('deliverable_id', $d->id)
                ->update(['priority' => $d->priority]);
        }

        // 3. Drop priority column from deliverables
        Schema::table('deliverables', function (Blueprint $table) {
            $table->dropColumn('priority');
        });
    }
};
