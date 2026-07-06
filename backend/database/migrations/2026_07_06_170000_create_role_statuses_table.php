<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_statuses', function (Blueprint $table) {
            $table->id();
            $table->string('role', 50);
            $table->string('status_slug', 50);
            $table->timestamps();

            $table->unique(['role', 'status_slug']);
        });

        // Población inicial de estados por rol según constante estática antigua
        $initial = [
            'expert' => ['not_started', 'draft', 'in_development', 'delivered', 'adjustments_requested', 'approved', 'not_applicable'],
            'pedagogy' => ['not_started', 'in_progress', 'in_review', 'adjusting', 'delivered', 'approved', 'not_applicable'],
            'design' => ['not_started', 'designing', 'adjusting', 'delivered', 'approved', 'not_applicable'],
            'audiovisual' => ['not_started', 'production', 'editing', 'delivered', 'approved', 'not_applicable'],
            'engineering' => ['not_started', 'implementing', 'validating', 'delivered', 'approved', 'not_applicable'],
            'qa' => ['pending', 'in_testing', 'with_findings', 'approved', 'not_applicable'],
        ];

        $now = now();
        foreach ($initial as $role => $slugs) {
            foreach ($slugs as $slug) {
                DB::table('role_statuses')->insert([
                    'role' => $role,
                    'status_slug' => $slug,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('role_statuses');
    }
};
