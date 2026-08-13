<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class VocabularyApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_creates_lists_and_deletes_vocabulary_terms(): void
    {
        $created = $this->postJson('/api/v1/vocabulary', [
            'term' => 'مقابلة',
            'kind' => 'type',
            'aliases' => 'interview',
            'note' => 'محتوى حواري',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('term.term', 'مقابلة')
            ->assertJsonPath('term.kind', 'type')
            ->assertJsonPath('term.aliases', 'interview');

        $id = $created->json('term.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/vocabulary', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'terms')
            ->assertJsonPath('terms.0.id', $id);

        $this->deleteJson('/api/v1/vocabulary/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/vocabulary', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'terms');
    }

    public function test_it_defaults_kind_to_custom(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => 'بلا نوع',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('term.kind', 'custom');
    }

    public function test_it_supports_person_place_and_event_terms(): void
    {
        foreach (['person' => 'مراسل', 'place' => 'غزة', 'event' => 'مؤتمر'] as $kind => $term) {
            $this->postJson('/api/v1/vocabulary', ['term' => $term, 'kind' => $kind], $this->authHeaders())
                ->assertCreated()
                ->assertJsonPath('term.kind', $kind);
        }
    }

    public function test_it_allows_configuring_additional_dictionary_categories(): void
    {
        $this->putJson('/api/v1/vocabulary/kinds', [
            'kinds' => [[
                'key' => 'organization',
                'label' => 'مؤسسة',
                'description' => 'الهيئات ووسائل الإعلام',
                'icon' => '🏢',
                'order' => 10,
            ]],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonFragment(['key' => 'organization', 'label' => 'مؤسسة']);

        $this->postJson('/api/v1/vocabulary', [
            'term' => 'وكالة الأنباء',
            'kind' => 'organization',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('term.kind', 'organization');

        $this->getJson('/api/v1/vocabulary/kinds', $this->authHeaders())
            ->assertOk()
            ->assertJsonFragment(['key' => 'organization', 'description' => 'الهيئات ووسائل الإعلام']);
    }

    public function test_it_preserves_a_configured_category_used_by_a_term(): void
    {
        $this->putJson('/api/v1/vocabulary/kinds', [
            'kinds' => [['key' => 'organization', 'label' => 'مؤسسة']],
        ], $this->authHeaders())->assertOk();
        $this->postJson('/api/v1/vocabulary', ['term' => 'وكالة الأنباء', 'kind' => 'organization'], $this->authHeaders())
            ->assertCreated();

        $this->putJson('/api/v1/vocabulary/kinds', ['kinds' => []], $this->authHeaders())
            ->assertUnprocessable();
    }

    public function test_it_scopes_terms_to_the_owning_user(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => 'Mine',
        ], $this->authHeaders())->assertCreated();

        User::query()->firstOrCreate(
            ['email' => 'other@example.test'],
            ['name' => 'Other User', 'password' => Hash::make('secret-password')]
        );
        $otherToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'other@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->getJson('/api/v1/vocabulary', ['Authorization' => 'Bearer '.$otherToken])
            ->assertOk()
            ->assertJsonCount(0, 'terms');
    }

    public function test_it_rejects_invalid_vocabulary_payload(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => '',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_invalid_kind(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => 'Bad kind',
            'kind' => 'nope',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_deleting_missing_term(): void
    {
        $this->deleteJson('/api/v1/vocabulary/missing', [], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/v1/vocabulary')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_department_preferences_only_prioritize_owned_terms(): void
    {
        $first = $this->postJson('/api/v1/vocabulary', ['term' => 'عام'], $this->authHeaders())->assertCreated()->json('term.id');
        $preferred = $this->postJson('/api/v1/vocabulary', ['term' => 'قسم'], $this->authHeaders())->assertCreated()->json('term.id');
        $this->putJson('/api/v1/vocabulary/department-preferences', ['departmentId' => 'news', 'termIds' => [$preferred]], $this->authHeaders())->assertOk();
        $this->assertDatabaseHas('audit_logs', ['event' => 'department_vocabulary_preferences.replace', 'resource_id' => 'news']);
        $this->getJson('/api/v1/vocabulary?departmentId=news', $this->authHeaders())->assertOk()->assertJsonPath('terms.0.id', $preferred)->assertJsonPath('preferredTermIds.0', $preferred)->assertJsonCount(2, 'terms');
        $this->assertNotSame($first, $preferred);
    }

    public function test_department_preferences_reject_terms_owned_by_another_user(): void
    {
        User::query()->firstOrCreate(
            ['email' => 'other-preference@example.test'],
            ['name' => 'Other User', 'password' => Hash::make('secret-password'), 'role' => 'editor']
        );
        $otherToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'other-preference@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');
        $otherTermId = $this->postJson('/api/v1/vocabulary', ['term' => 'خاص'], ['Authorization' => 'Bearer '.$otherToken])
            ->assertCreated()
            ->json('term.id');

        $this->putJson('/api/v1/vocabulary/department-preferences', ['departmentId' => 'news', 'termIds' => [$otherTermId]], $this->authHeaders())
            ->assertUnprocessable();
    }
}
