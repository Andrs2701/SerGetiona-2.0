<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deliverables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->string('name');
            $table->enum('type', ['creation', 'update'])->default('creation');
            $table->enum('global_status', ['unpublished', 'pending_start', 'in_progress', 'in_review', 'with_observations', 'finished', 'cancelled', 'not_applicable'])->default('unpublished');
            $table->date('start_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deliverables');
    }
};
