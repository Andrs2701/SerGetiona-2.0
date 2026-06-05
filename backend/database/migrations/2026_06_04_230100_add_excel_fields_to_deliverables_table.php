<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('deliverables', function (Blueprint $table) {
            // Campos del Excel (Bd_Calendario)
            $table->string('record_type')->nullable()->after('type'); // Pregrado, Posgrado, Asignatura, Tarea, Curso, Externo
            $table->string('content_type')->nullable()->after('record_type'); // SCORM, RISE, Multimedia, Varios, Actualizaciones
            $table->string('semestre')->nullable()->after('content_type');
            $table->string('ciclo')->nullable()->after('semestre');
            $table->string('requirement')->nullable()->after('notes'); // Requerimiento
            $table->text('observation')->nullable()->after('requirement');
        });

        Schema::table('role_activities', function (Blueprint $table) {
            // Checklist por rol (del Excel: P_Pedagogia, P_Diseno, P_Audiovisual, P_Ingeniero)
            $table->json('checklist')->nullable()->after('notes');
            // Estructura: {"item1": true/false, "item2": true/false, ...}
            // Pedagogía: entrega_pedagogia, multimedia, descargable, actividades, guiones
            // Diseño: entrega_diseno, multimedia, descargable, banners
            // Audiovisual: entrega_audiovisual, videos, videos_animados, video_podcast
            // Ingeniería: entrega_ingenieria, act_evaluativas, act_interactivas
            // Calidad: entrega_calidad
        });
    }

    public function down(): void
    {
        Schema::table('deliverables', function (Blueprint $table) {
            $table->dropColumn(['record_type', 'content_type', 'semestre', 'ciclo', 'requirement', 'observation']);
        });
        Schema::table('role_activities', function (Blueprint $table) {
            $table->dropColumn('checklist');
        });
    }
};
