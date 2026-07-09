<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * QA no "entrega" — QA aprueba directamente.
     * 1. Agregar 'approved' a QA si no existe.
     * 2. Eliminar 'delivered' de QA.
     */
    public function up(): void
    {
        // Verificar si QA ya tiene 'approved' configurado
        $hasApproved = DB::table('role_statuses')
            ->where('role', 'qa')
            ->where('status_slug', 'approved')
            ->exists();

        if (!$hasApproved) {
            // Obtener el mayor sort_order para QA
            $maxSort = DB::table('role_statuses')
                ->where('role', 'qa')
                ->max('sort_order') ?? 0;

            DB::table('role_statuses')->insert([
                'role'        => 'qa',
                'status_slug' => 'approved',
                'sort_order'  => $maxSort + 1,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        // Eliminar 'delivered' de QA (QA aprueba, no entrega)
        DB::table('role_statuses')
            ->where('role', 'qa')
            ->where('status_slug', 'delivered')
            ->delete();
    }

    /**
     * Revertir: eliminar 'approved' de QA y agregar 'delivered' de vuelta.
     */
    public function down(): void
    {
        // Re-agregar 'delivered' a QA
        $hasDelivered = DB::table('role_statuses')
            ->where('role', 'qa')
            ->where('status_slug', 'delivered')
            ->exists();

        if (!$hasDelivered) {
            $maxSort = DB::table('role_statuses')
                ->where('role', 'qa')
                ->max('sort_order') ?? 0;

            DB::table('role_statuses')->insert([
                'role'        => 'qa',
                'status_slug' => 'delivered',
                'sort_order'  => $maxSort + 1,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        // No eliminamos 'approved' en down por seguridad
    }
};
