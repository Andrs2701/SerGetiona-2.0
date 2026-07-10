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
        Schema::dropIfExists('evidences');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('evidences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_activity_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('disk')->default('local');
            $table->string('path');
            $table->string('mime_type');
            $table->integer('version')->default(1);
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }
};
