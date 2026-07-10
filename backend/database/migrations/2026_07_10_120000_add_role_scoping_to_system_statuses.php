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
        Schema::table('system_statuses', function (Blueprint $table) {
            $table->json('allowed_roles')->nullable()->after('type');
            $table->boolean('is_manager_only')->default(false)->after('allowed_roles');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('system_statuses', function (Blueprint $table) {
            $table->dropColumn(['allowed_roles', 'is_manager_only']);
        });
    }
};
