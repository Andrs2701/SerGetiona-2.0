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
        Schema::create('production_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deliverable_id')->nullable()->constrained('deliverables')->nullOnDelete();
            $table->foreignId('role_activity_id')->nullable()->constrained('role_activities')->nullOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->string('entity_type', 50);
            $table->unsignedBigInteger('entity_id');
            $table->string('role', 30);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type', 40);
            $table->string('from_state', 40)->nullable();
            $table->string('to_state', 40)->nullable();
            $table->string('reason_code', 50)->nullable();
            $table->json('payload')->nullable();
            $table->string('ciclo', 15)->nullable();
            $table->dateTime('occurred_at', 3);
            $table->timestamps();

            $table->index(['deliverable_id', 'occurred_at']);
            $table->index(['role', 'event_type', 'occurred_at']);
            $table->index(['user_id', 'event_type', 'occurred_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('production_events');
    }
};
