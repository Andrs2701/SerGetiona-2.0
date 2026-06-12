<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_roles', function (Blueprint $table) {
            $table->string('slug')->primary();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('system_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('module', 100);
            $table->string('action', 100);
            $table->string('view_path', 255)->nullable();
            $table->json('allowed_roles'); // JSON array of role slugs
            $table->text('description')->nullable();
            $table->timestamps();

            $table->unique(['module', 'action']);
        });

        Schema::create('system_statuses', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20); // deliverable | task
            $table->string('slug', 50);
            $table->string('label', 100);
            $table->string('color', 100)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['type', 'slug']);
        });

        Schema::create('state_transitions', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20); // deliverable | task
            $table->string('from_status', 50);
            $table->string('to_status', 50);
            $table->json('allowed_roles'); // JSON array of role slugs
            $table->timestamps();

            $table->unique(['type', 'from_status', 'to_status']);
        });

        Schema::create('visibility_rules', function (Blueprint $table) {
            $table->id();
            $table->string('role_slug', 50)->unique();
            $table->string('scope', 20)->default('all'); // all | assigned_only
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visibility_rules');
        Schema::dropIfExists('state_transitions');
        Schema::dropIfExists('system_statuses');
        Schema::dropIfExists('system_permissions');
        Schema::dropIfExists('system_roles');
    }
};
