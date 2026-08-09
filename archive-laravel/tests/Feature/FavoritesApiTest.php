<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class FavoritesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_saves_and_lists_favorites_for_the_current_user(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'favorite-record',
            'data' => json_encode(['id' => 'favorite-record', 'title' => 'مادة مهمة', 'type' => 'video'], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/v1/favorites', ['recordId' => 'favorite-record'], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('favorite.recordId', 'favorite-record')
            ->assertJsonPath('favorite.title', 'مادة مهمة');

        $this->getJson('/api/v1/favorites', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'favorites')
            ->assertJsonPath('favorites.0.type', 'video');

        $this->deleteJson('/api/v1/favorites/favorite-record', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);
    }

    public function test_it_does_not_expose_one_users_favorites_to_another(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'private-favorite',
            'data' => json_encode(['id' => 'private-favorite', 'title' => 'خاص'], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->postJson('/api/v1/favorites', ['recordId' => 'private-favorite'], $this->authHeaders())->assertCreated();

        User::query()->create([
            'name' => 'Other', 'email' => 'favorites-other@example.test',
            'password' => Hash::make('secret-password'),
        ]);
        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'favorites-other@example.test', 'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->getJson('/api/v1/favorites', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonCount(0, 'favorites');
    }
}
