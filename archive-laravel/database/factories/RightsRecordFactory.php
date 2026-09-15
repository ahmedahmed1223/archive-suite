<?php

namespace Database\Factories;

use App\Models\RightsRecord;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<RightsRecord>
 */
class RightsRecordFactory extends Factory
{
    protected $model = RightsRecord::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'item_id' => Str::uuid(),
            'rights_holder' => fake()->company(),
            'license_type' => fake()->randomElement(['CC-BY', 'CC-BY-SA', 'PROPRIETARY', 'UNKNOWN']),
            'embargo_start' => null,
            'embargo_end' => null,
            'expires_at' => null,
            'geo_restrictions' => [],
            'notes' => fake()->optional()->sentence(),
        ];
    }
}
