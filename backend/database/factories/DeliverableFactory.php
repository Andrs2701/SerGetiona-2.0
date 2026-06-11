<?php

namespace Database\Factories;

use App\Models\Deliverable;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class DeliverableFactory extends Factory
{
    protected $model = Deliverable::class;

    public function definition(): array
    {
        return [
            'subject_id'    => Subject::factory(),
            'name'          => fake()->unique()->words(3, true),
            'type'          => fake()->randomElement(['creation', 'update']),
            'global_status' => 'pending_start',
            'created_by'    => User::factory()->create(['role' => 'admin', 'is_active' => true])->id,
        ];
    }
}
