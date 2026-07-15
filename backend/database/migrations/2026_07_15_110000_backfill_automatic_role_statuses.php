<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. approved = true para todos excepto qa
        DB::table('role_statuses')
            ->where('status_slug', 'approved')
            ->where('role', '!=', 'qa')
            ->update(['is_automatic' => true]);

        // 2. adjustments_requested = true para todos
        DB::table('role_statuses')
            ->where('status_slug', 'adjustments_requested')
            ->update(['is_automatic' => true]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('role_statuses')->update(['is_automatic' => false]);
    }
};
