<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nivel de complejidad por recurso producido, apuntando al catálogo real
 * (complexity_levels) en vez de guardarse como texto libre en `description`.
 *
 * Solo esquema: en MySQL un ALTER TABLE hace commit implícito y no debe
 * mezclarse con cambios de datos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('production_logs', function (Blueprint $table) {
            $table->foreignId('complexity_level_id')
                ->nullable()
                ->after('quantity')
                ->constrained('complexity_levels')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('production_logs', function (Blueprint $table) {
            $table->dropForeign(['complexity_level_id']);
            $table->dropColumn('complexity_level_id');
        });
    }
};
