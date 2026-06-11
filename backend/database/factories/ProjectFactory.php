<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProjectFactory extends Factory
{
    protected $model = Project::class;

    public function definition(): array
    {
        static $adminId = null;
        if (!$adminId) {
            $adminId = User::factory()->create(['role' => 'admin', 'is_active' => true])->id;
        }

        return [
            'name'       => fake()->unique()->words(4, true),
            'description'=> fake()->sentence(),
            'status'     => fake()->randomElement(['draft', 'in_progress', 'parameterized']),
            'start_date' => fake()->dateTimeBetween('-6 months', 'now')->format('Y-m-d'),
            'end_date'   => fake()->dateTimeBetween('now', '+6 months')->format('Y-m-d'),
            'created_by' => $adminId,
        ];
    }
}
