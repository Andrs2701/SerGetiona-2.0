<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('decision_records', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('decision_date');
        });
    }

    public function down()
    {
        Schema::table('decision_records', function (Blueprint $table) {
            $table->dropColumn('due_date');
        });
    }
};
