<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AccountExportApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_export_their_own_data(): void
    {
        $user = User::query()->create([
            'name' => 'Exporter',
            'email' => 'exporter@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);
        $headers = ['Authorization' => 'Bearer '.$this->tokenFor($user)];

        DB::table('saved_searches')->insert([
            'id' => 'ss-1',
            'user_id' => (string) $user->getKey(),
            'name' => 'My search',
            'query' => 'test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/account/export', $headers)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('export.user.email', 'exporter@example.test')
            ->assertJsonCount(1, 'export.savedSearches');

        $this->assertSame('ss-1', $response->json('export.savedSearches.0.id'));
    }

    public function test_export_never_includes_another_users_data(): void
    {
        $me = User::query()->create([
            'name' => 'Me',
            'email' => 'me@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);
        $other = User::query()->create([
            'name' => 'Other',
            'email' => 'other@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        DB::table('saved_searches')->insert([
            'id' => 'ss-other',
            'user_id' => (string) $other->getKey(),
            'name' => 'Not mine',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $headers = ['Authorization' => 'Bearer '.$this->tokenFor($me)];

        $this->getJson('/api/v1/account/export', $headers)
            ->assertOk()
            ->assertJsonCount(0, 'export.savedSearches');
    }

    public function test_export_requires_authentication(): void
    {
        $this->getJson('/api/v1/account/export')->assertUnauthorized();
    }

    private function tokenFor(User $user): string
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return $login->json('accessToken');
    }
}
