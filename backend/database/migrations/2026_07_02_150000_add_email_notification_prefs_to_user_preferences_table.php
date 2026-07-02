<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_preferences', function (Blueprint $table) {
            $table->boolean('email_notifications_enabled')->default(true)->after('right_sidebar_open');
            $table->boolean('email_tasks')->default(true)->after('email_notifications_enabled');
            $table->boolean('email_chat')->default(true)->after('email_tasks');
            $table->boolean('email_deadlines')->default(true)->after('email_chat');
        });
    }

    public function down(): void
    {
        Schema::table('user_preferences', function (Blueprint $table) {
            $table->dropColumn(['email_notifications_enabled', 'email_tasks', 'email_chat', 'email_deadlines']);
        });
    }
};
