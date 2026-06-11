<?php

namespace Database\Factories;

use App\Models\Subject;
use App\Models\AcademicProgram;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubjectFactory extends Factory
{
    protected $model = Subject::class;

    public function definition(): array
    {
        return [
            'academic_program_id' => AcademicProgram::factory(),
            'name'                => fake()->unique()->words(3, true),
            'code'                => strtoupper(fake()->lexify('???###')),
            'created_by'          => User::factory()->create(['role' => 'admin', 'is_active' => true])->id,
        ];
    }
}
