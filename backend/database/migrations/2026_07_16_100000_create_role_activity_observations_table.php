<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('role_activity_observations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_activity_id')->constrained('role_activities')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users');
            $table->text('observation');
            $table->timestamps();
        });

        DB::transaction(function () {
            DB::table('role_activities')
                ->whereNotNull('notes')
                ->where('notes', '!=', '')
                ->chunkById(100, function ($activities) {
                    $observations = [];
                    foreach ($activities as $activity) {
                        $observations[] = [
                            'role_activity_id' => $activity->id,
                            'user_id' => $activity->responsible_id ?? 1,
                            'observation' => $activity->notes,
                            'created_at' => $activity->updated_at ?? now(),
                            'updated_at' => $activity->updated_at ?? now(),
                        ];
                    }
                    if (!empty($observations)) {
                        DB::table('role_activity_observations')->insert($observations);
                    }
                });
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_activity_observations');
    }
};
