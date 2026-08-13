<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DisplaySettingsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('admin@example.test', 'admin');
        $this->createUser('viewer@example.test', 'viewer');
    }

    public function test_authenticated_users_read_the_default_display_settings(): void
    {
        $response = $this->getJson('/api/v1/system/display-settings', $this->headersFor('viewer@example.test'));

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('settings.timeZone', 'Europe/Istanbul')
            ->assertJsonPath('settings.dateFormat', 'DD/MM/YYYY')
            ->assertJsonPath('settings.timeFormat', '24h')
            ->assertJsonPath('settings.showSeconds', false);
    }

    public function test_display_settings_require_authentication(): void
    {
        $this->getJson('/api/v1/system/display-settings')->assertUnauthorized();
    }

    public function test_admin_can_update_and_persist_display_settings(): void
    {
        $settings = [
            'timeZone' => 'America/New_York',
            'dateFormat' => 'YYYY-MM-DD',
            'timeFormat' => '12h',
            'showSeconds' => true,
        ];

        $this->patchJson('/api/v1/system/display-settings', $settings, $this->headersFor('admin@example.test'))
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('settings', $settings);

        $this->getJson('/api/v1/system/display-settings', $this->headersFor('viewer@example.test'))
            ->assertOk()
            ->assertJsonPath('settings', $settings);
    }

    public function test_non_admin_cannot_update_display_settings(): void
    {
        $this->patchJson('/api/v1/system/display-settings', ['timeFormat' => '12h'], $this->headersFor('viewer@example.test'))
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_display_settings_reject_an_invalid_iana_time_zone(): void
    {
        $this->patchJson('/api/v1/system/display-settings', ['timeZone' => 'Invalid/Zone'], $this->headersFor('admin@example.test'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('timeZone');
    }

    #[DataProvider('invalidEnumValues')]
    public function test_display_settings_reject_invalid_format_enums(string $field, string $value): void
    {
        $this->patchJson('/api/v1/system/display-settings', [$field => $value], $this->headersFor('admin@example.test'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function invalidEnumValues(): array
    {
        return [
            'date format' => ['dateFormat', 'DD-YYYY-MM'],
            'time format' => ['timeFormat', 'AM/PM'],
        ];
    }

    /** @return array<string, string> */
    private function headersFor(string $email): array
    {
        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password',
        ])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }

    private function createUser(string $email, string $role): void
    {
        User::query()->create([
            'name' => $role,
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }
}
