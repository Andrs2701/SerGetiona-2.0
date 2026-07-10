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
        Schema::table('role_activities', function (Blueprint $table) {
            $table->index(['commitment_date', 'status']);
            $table->index(['role', 'status']);
        });

        Schema::table('deliverables', function (Blueprint $table) {
            $table->index('global_status');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index(['entity_type', 'entity_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('role_activities', function (Blueprint $table) {
            $table->dropIndex(['commitment_date', 'status']);
            $table->dropIndex(['role', 'status']);
        });

        Schema::table('deliverables', function (Blueprint $table) {
            $table->dropIndex(['global_status']);
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['entity_type', 'entity_id']);
        });
    }
};
