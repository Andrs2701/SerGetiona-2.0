<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deliverable_id')->constrained('deliverables')->cascadeOnDelete();
            $table->enum('role', ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']);
            $table->foreignId('responsible_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->date('commitment_date')->nullable();
            $table->date('actual_start_date')->nullable();
            $table->date('actual_delivery_date')->nullable();
            $table->string('status')->default('not_started');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_activities');
    }
};
