<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SettingsRegistryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_read_actual_capabilities_with_provenance(): void
    {
        config(['archive.features.odbc' => true]);
        $viewer = User::factory()->create(['role' => 'viewer']);

        $response = $this->actingAs($viewer)->getJson('/api/v1/system/capabilities');

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('schemaVersion', 1)
            ->assertJsonPath('capabilities.odbc.value', true)
            ->assertJsonPath('capabilities.odbc.source', 'deployment')
            ->assertJsonPath('capabilities.odbc.editable', false)
            ->assertJsonPath('capabilities.odbc.status', 'enabled')
            ->assertJsonStructure([
                'capabilities' => [
                    'systemControl' => ['value', 'source', 'editable', 'status', 'reason'],
                    'backups' => ['value', 'source', 'editable', 'status', 'reason'],
                    'trash' => ['value', 'source', 'editable', 'status', 'reason'],
                    'odbc' => ['value', 'source', 'editable', 'status', 'reason'],
                    'broadcastMetadata' => ['value', 'source', 'editable', 'status', 'reason'],
                    'semanticSearch' => ['value', 'source', 'editable', 'status', 'reason'],
                    'mediaProcessing' => ['value', 'source', 'editable', 'status', 'reason'],
                    'ocr' => ['value', 'source', 'editable', 'status', 'reason'],
                    'mcp' => ['value', 'source', 'editable', 'status', 'reason'],
                ],
            ])
            ->assertJsonMissingPath('capabilities.askArchive')
            ->assertJsonMissingPath('capabilities.multimodalAnalysis');
    }

    public function test_admin_can_disable_an_available_runtime_capability(): void
    {
        config(['archive.features.odbc' => true]);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->patchJson('/api/v1/system/capabilities', ['odbc' => false])
            ->assertOk()
            ->assertJsonPath('capabilities.odbc.value', false)
            ->assertJsonPath('capabilities.odbc.source', 'system')
            ->assertJsonPath('capabilities.odbc.editable', true)
            ->assertJsonPath('capabilities.odbc.status', 'disabled');

        $this->assertDatabaseHas('capability_settings', [
            'key' => 'odbc',
            'updated_by_user_id' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/system/odbc')
            ->assertNotFound();
    }

    public function test_semantic_search_capability_does_not_claim_enabled_during_keyword_fallback(): void
    {
        config([
            'embeddings.enabled' => true,
            'embeddings.provider' => 'openai',
            'embeddings.api_key' => 'sk-test',
        ]);
        $viewer = User::factory()->create(['role' => 'viewer']);

        $this->actingAs($viewer)
            ->getJson('/api/v1/system/capabilities')
            ->assertOk()
            ->assertJsonPath('capabilities.semanticSearch.value', false)
            ->assertJsonPath('capabilities.semanticSearch.status', 'needs_configuration');
    }

    public function test_capability_update_rejects_unknown_keys_and_wrong_types(): void
    {
        config(['archive.features.odbc' => true]);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->patchJson('/api/v1/system/capabilities', ['futureAi' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('futureAi');

        $this->actingAs($admin)
            ->patchJson('/api/v1/system/capabilities', ['odbc' => 'false'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('odbc');
    }

    public function test_capability_update_rejects_an_empty_payload(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->patchJson('/api/v1/system/capabilities', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('request');
    }

    public function test_non_admin_cannot_update_capabilities(): void
    {
        config(['archive.features.odbc' => true]);
        $viewer = User::factory()->create(['role' => 'viewer']);

        $this->actingAs($viewer)
            ->patchJson('/api/v1/system/capabilities', ['odbc' => false])
            ->assertForbidden();
    }

    public function test_deployment_lock_cannot_be_overridden(): void
    {
        config(['archive.features.odbc' => false]);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->patchJson('/api/v1/system/capabilities', ['odbc' => true])
            ->assertForbidden()
            ->assertJsonPath('code', 'SETTING_LOCKED')
            ->assertJsonPath('source', 'deployment');
    }

    public function test_user_reads_default_experience_profile_with_provenance(): void
    {
        $user = User::factory()->create(['locale' => null]);

        $response = $this->actingAs($user)->getJson('/api/v1/account/experience');

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('schemaVersion', 1)
            ->assertJsonPath('profileVersion', 0)
            ->assertJsonPath('experience.locale.value', 'ar')
            ->assertJsonPath('experience.locale.source', 'default')
            ->assertJsonPath('experience.locale.editable', true)
            ->assertJsonPath('experience.density.value', 'comfortable')
            ->assertJsonStructure([
                'experience' => [
                    'locale' => ['value', 'source', 'editable'],
                    'timeZone' => ['value', 'source', 'editable'],
                    'dateFormat' => ['value', 'source', 'editable'],
                    'timeFormat' => ['value', 'source', 'editable'],
                    'theme' => ['value', 'source', 'editable'],
                    'density' => ['value', 'source', 'editable'],
                    'textScale' => ['value', 'source', 'editable'],
                    'reducedMotion' => ['value', 'source', 'editable'],
                    'homePage' => ['value', 'source', 'editable'],
                    'navigation' => ['value', 'source', 'editable'],
                    'views' => ['value', 'source', 'editable'],
                    'shortcuts' => ['value', 'source', 'editable'],
                    'notifications' => ['value', 'source', 'editable'],
                    'studioLayout' => ['value', 'source', 'editable'],
                ],
            ]);
    }

    public function test_user_can_update_and_persist_their_experience_profile(): void
    {
        $user = User::factory()->create(['locale' => 'ar']);
        $values = [
            'locale' => 'en',
            'timeZone' => 'Europe/London',
            'theme' => 'neutral-light',
            'density' => 'compact',
            'textScale' => 'large',
            'homePage' => '/daily',
            'views' => ['archive' => ['mode' => 'grid', 'pageSize' => 50]],
            'shortcuts' => ['playPause' => 'Space'],
            'notifications' => ['dailyDigest' => true, 'optional' => ['reviewAssigned']],
            'studioLayout' => ['comments' => 'right', 'timelineHeight' => 320],
        ];

        $this->actingAs($user)
            ->patchJson('/api/v1/account/experience', $values)
            ->assertOk()
            ->assertJsonPath('profileVersion', 1)
            ->assertJsonPath('experience.locale.value', 'en')
            ->assertJsonPath('experience.locale.source', 'user')
            ->assertJsonPath('experience.views.value.archive.mode', 'grid')
            ->assertJsonPath('experience.studioLayout.value.timelineHeight', 320);

        $this->assertDatabaseHas('user_experience_profiles', ['user_id' => $user->id, 'version' => 1]);
        $this->assertSame('en', $user->refresh()->locale);

        $this->actingAs($user->refresh())
            ->getJson('/api/v1/account/experience')
            ->assertOk()
            ->assertJsonPath('experience.shortcuts.value.playPause', 'Space');
    }

    public function test_experience_update_rejects_unknown_keys_and_wrong_types(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/account/experience', ['futurePreference' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('futurePreference');

        $this->actingAs($user)
            ->patchJson('/api/v1/account/experience', ['views' => 'grid'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('views');

        $this->actingAs($user)
            ->patchJson('/api/v1/account/experience', ['timeZone' => 'Not/AZone'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('timeZone');
    }

    /** @param array<string, mixed> $value */
    #[DataProvider('unknownNestedExperienceKeys')]
    public function test_experience_update_rejects_unknown_nested_keys(string $field, array $value, string $errorKey): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/account/experience', [$field => $value])
            ->assertUnprocessable()
            ->assertJsonValidationErrors($errorKey);
    }

    /** @return array<string, array{string, array<string, mixed>, string}> */
    public static function unknownNestedExperienceKeys(): array
    {
        return [
            'navigation' => ['navigation', ['future' => []], 'navigation'],
            'views' => ['views', ['archive' => ['future' => true]], 'views.archive'],
            'shortcuts' => ['shortcuts', ['future' => 'F9'], 'shortcuts'],
            'notifications' => ['notifications', ['future' => true], 'notifications'],
            'studio layout' => ['studioLayout', ['future' => 'wide'], 'studioLayout'],
        ];
    }

    /** @param array<string, mixed> $value */
    #[DataProvider('invalidNestedExperienceTypes')]
    public function test_experience_update_rejects_invalid_nested_types(string $field, array $value, string $errorKey): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/account/experience', [$field => $value])
            ->assertUnprocessable()
            ->assertJsonValidationErrors($errorKey);
    }

    /** @return array<string, array{string, array<string, mixed>, string}> */
    public static function invalidNestedExperienceTypes(): array
    {
        return [
            'navigation order' => ['navigation', ['order' => 'archive'], 'navigation.order'],
            'views page size' => ['views', ['archive' => ['pageSize' => 'many']], 'views.archive.pageSize'],
            'shortcut binding' => ['shortcuts', ['playPause' => false], 'shortcuts.playPause'],
            'notification digest' => ['notifications', ['dailyDigest' => 'yes'], 'notifications.dailyDigest'],
            'studio timeline height' => ['studioLayout', ['timelineHeight' => 'huge'], 'studioLayout.timelineHeight'],
        ];
    }

    public function test_experience_update_rejects_an_empty_payload(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/account/experience', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('request');
    }

    public function test_user_can_reset_their_experience_profile(): void
    {
        $user = User::factory()->create(['locale' => 'ar']);

        $this->actingAs($user)
            ->patchJson('/api/v1/account/experience', ['locale' => 'en', 'density' => 'compact'])
            ->assertOk();

        $this->actingAs($user->refresh())
            ->deleteJson('/api/v1/account/experience')
            ->assertOk()
            ->assertJsonPath('profileVersion', 0)
            ->assertJsonPath('experience.locale.value', 'ar')
            ->assertJsonPath('experience.locale.source', 'default')
            ->assertJsonPath('experience.density.value', 'comfortable');

        $this->assertDatabaseMissing('user_experience_profiles', ['user_id' => $user->id]);
        $this->assertNull($user->refresh()->locale);
    }

    public function test_settings_registry_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/system/capabilities')->assertUnauthorized();
        $this->patchJson('/api/v1/system/capabilities', ['odbc' => false])->assertUnauthorized();
        $this->getJson('/api/v1/account/experience')->assertUnauthorized();
        $this->patchJson('/api/v1/account/experience', ['locale' => 'en'])->assertUnauthorized();
        $this->deleteJson('/api/v1/account/experience')->assertUnauthorized();
    }
}
