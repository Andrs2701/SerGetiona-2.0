<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('capacity_snapshots', function (Blueprint $table) {
            $table->id();
            $table->date('snapshot_date')->index();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20);
            $table->decimal('active_points', 8, 1);
            $table->unsignedSmallInteger('active_activities');
            $table->decimal('capacity_points', 8, 1);
            $table->decimal('utilization_pct', 6, 1);
            $table->unsignedSmallInteger('overdue_count');
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['snapshot_date', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capacity_snapshots');
    }
};
