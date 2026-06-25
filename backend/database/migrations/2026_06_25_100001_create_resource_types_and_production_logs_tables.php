<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resource_types', function (Blueprint $table) {
            $table->id();
            $table->string('role');
            $table->string('name');
            $table->string('slug');
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['role', 'slug']);
            $table->index('role');
        });

        Schema::create('production_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_activity_id')->constrained('role_activities')->cascadeOnDelete();
            $table->foreignId('resource_type_id')->constrained('resource_types')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->string('description')->nullable();
            $table->foreignId('produced_by')->constrained('users');
            $table->foreignId('logged_by')->constrained('users');
            $table->date('produced_at');
            $table->timestamps();

            $table->index('role_activity_id');
            $table->index('produced_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_logs');
        Schema::dropIfExists('resource_types');
    }
};
