<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Actividad creada" en la línea de tiempo nunca decía quién la creó —
 * role_activities no tenía ningún campo para eso (a diferencia de
 * deliverables/subjects/academic_programs, que sí tienen created_by desde
 * el inicio).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('role_activities', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('assigned_by')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('role_activities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
    }
};
