<?php

namespace Database\Factories;

use App\Models\AcademicProgram;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AcademicProgramFactory extends Factory
{
    protected $model = AcademicProgram::class;

    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'name'       => fake()->unique()->words(3, true),
            'code'       => strtoupper(fake()->lexify('???###')),
            'created_by' => User::factory()->create(['role' => 'admin', 'is_active' => true])->id,
        ];
    }
}
