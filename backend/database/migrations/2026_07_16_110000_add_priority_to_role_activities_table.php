<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('role_activities', function (Blueprint $table) {
            $table->string('priority')->default('media'); // alta, media, baja
        });
    }

    public function down(): void
    {
        Schema::table('role_activities', function (Blueprint $table) {
            $table->dropColumn('priority');
        });
    }
};
