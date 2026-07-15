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
        Schema::table('role_statuses', function (Blueprint $table) {
            $table->boolean('is_automatic')->default(false)->after('status_slug');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('role_statuses', function (Blueprint $table) {
            $table->dropColumn('is_automatic');
        });
    }
};
