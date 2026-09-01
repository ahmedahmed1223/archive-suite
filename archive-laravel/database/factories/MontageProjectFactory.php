<?php

namespace Database\Factories;

use App\Models\MontageProject;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class MontageProjectFactory extends Factory
{
    protected $model = MontageProject::class;

    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'name' => $this->faker->words(3, true),
            'description' => $this->faker->sentence(),
            'fps' => 25,
            'status' => 'draft',
        ];
    }
}
