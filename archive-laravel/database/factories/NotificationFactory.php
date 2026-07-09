<?php

namespace Database\Factories;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class NotificationFactory extends Factory
{
    protected $model = Notification::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'type' => $this->faker->randomElement(['ingest_complete', 'backup_result', 'share_event', 'restore_result']),
            'title' => $this->faker->sentence(),
            'message' => $this->faker->paragraph(),
            'metadata' => [
                'test' => true,
            ],
            'is_read' => false,
        ];
    }

    public function read(): self
    {
        return $this->state(function (): array {
            return ['is_read' => true];
        });
    }
}
