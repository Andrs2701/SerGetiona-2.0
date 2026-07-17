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
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE deliverables MODIFY COLUMN type ENUM('creation', 'update', 'change_control') NOT NULL DEFAULT 'creation'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            // First we make sure to update any change_control type to update (or creation) to prevent enum conversion errors if reversing
            DB::table('deliverables')->where('type', 'change_control')->update(['type' => 'update']);

            DB::statement("ALTER TABLE deliverables MODIFY COLUMN type ENUM('creation', 'update') NOT NULL DEFAULT 'creation'");
        }
    }
};
