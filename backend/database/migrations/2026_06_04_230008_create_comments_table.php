<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deliverable_id')->constrained('deliverables')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('parent_id')->nullable()->constrained('comments')->nullOnDelete();
            $table->text('content');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};
