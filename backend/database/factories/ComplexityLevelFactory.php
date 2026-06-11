<?php

namespace Database\Factories;

use App\Models\ComplexityLevel;
use Illuminate\Database\Eloquent\Factories\Factory;

class ComplexityLevelFactory extends Factory
{
    protected $model = ComplexityLevel::class;

    public function definition(): array
    {
        return [
            'name'       => fake()->unique()->word(),
            'points'     => fake()->randomElement([1, 3, 5, 8]),
            'is_active'  => true,
            'sort_order' => fake()->numberBetween(1, 10),
        ];
    }
}
