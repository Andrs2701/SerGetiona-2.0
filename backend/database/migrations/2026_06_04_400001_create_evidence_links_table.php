<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evidence_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_activity_id')->constrained('role_activities')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('type', ['file', 'url', 'drive', 'onedrive', 'sharepoint', 'repository'])->default('url');
            $table->string('title');
            $table->text('url')->nullable();
            $table->string('filename')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evidence_links');
    }
};
