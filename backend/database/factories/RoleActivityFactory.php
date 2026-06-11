<?php

namespace Database\Factories;

use App\Models\RoleActivity;
use Illuminate\Database\Eloquent\Factories\Factory;

class RoleActivityFactory extends Factory
{
    protected $model = RoleActivity::class;

    public function definition(): array
    {
        return [
            'role'            => fake()->randomElement(['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']),
            'status'          => fake()->randomElement(['not_started', 'in_progress', 'in_review']),
            'commitment_date' => fake()->dateTimeBetween('now', '+30 days')->format('Y-m-d'),
        ];
    }
}
