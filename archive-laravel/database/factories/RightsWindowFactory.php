<?php

namespace Database\Factories;

use App\Models\RightsRecord;
use App\Models\RightsWindow;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<RightsWindow>
 */
class RightsWindowFactory extends Factory
{
    protected $model = RightsWindow::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'rights_record_id' => RightsRecord::factory(),
            'usage' => fake()->randomElement(['broadcast', 'digital_public', 'internal_archive', 'editorial_reuse']),
            'starts_at' => null,
            'ends_at' => null,
            'territories' => [],
            'platforms' => [],
            'granted' => true,
        ];
    }
}
