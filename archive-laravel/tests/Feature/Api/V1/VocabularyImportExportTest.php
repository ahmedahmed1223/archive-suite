<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class VocabularyImportExportTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_export_csv_lists_terms_for_the_owning_user(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => 'مقابلة',
            'kind' => 'type',
            'aliases' => 'interview',
        ], $this->authHeaders())->assertCreated();

        $response = $this->get('/api/v1/vocabulary/export?format=csv', $this->authHeaders());

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('term,kind,aliases,note', $response->getContent());
        $this->assertStringContainsString('مقابلة,type,interview', $response->getContent());
    }

    public function test_export_json_lists_terms_for_the_owning_user(): void
    {
        $this->postJson('/api/v1/vocabulary', ['term' => 'Solo'], $this->authHeaders())->assertCreated();

        $this->getJson('/api/v1/vocabulary/export?format=json', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(1, 'terms')
            ->assertJsonPath('terms.0.term', 'Solo');
    }

    public function test_export_rejects_unknown_format(): void
    {
        $this->getJson('/api/v1/vocabulary/export?format=xml', $this->authHeaders())
            ->assertUnprocessable();
    }

    public function test_import_json_creates_new_terms(): void
    {
        $file = UploadedFile::fake()->createWithContent(
            'terms.json',
            json_encode(['terms' => [
                ['term' => 'جديد', 'kind' => 'tag', 'aliases' => 'new, fresh'],
            ]])
        );

        $response = $this->post('/api/v1/vocabulary/import?format=json', ['file' => $file], $this->authHeaders());

        $response->assertOk();
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('created', 1);
        $response->assertJsonPath('merged', 0);

        $this->getJson('/api/v1/vocabulary', $this->authHeaders())
            ->assertJsonCount(1, 'terms')
            ->assertJsonPath('terms.0.term', 'جديد')
            ->assertJsonPath('terms.0.aliases', 'new, fresh');
    }

    public function test_import_csv_merges_synonyms_into_existing_term_without_duplicating(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => 'Interview',
            'aliases' => 'chat',
        ], $this->authHeaders())->assertCreated();

        $csv = "term,kind,aliases,note\n".'Interview,custom,"talk, chat",'."\n";
        $file = UploadedFile::fake()->createWithContent('terms.csv', $csv);

        $response = $this->post('/api/v1/vocabulary/import?format=csv', ['file' => $file], $this->authHeaders());

        $response->assertOk();
        $response->assertJsonPath('created', 0);
        $response->assertJsonPath('merged', 1);

        $listed = $this->getJson('/api/v1/vocabulary', $this->authHeaders())->assertJsonCount(1, 'terms');
        $aliases = $listed->json('terms.0.aliases');
        $this->assertStringContainsString('chat', $aliases);
        $this->assertStringContainsString('talk', $aliases);
        // "chat" must appear once, not duplicated by the merge.
        $this->assertSame(1, substr_count(strtolower($aliases), 'chat'));
    }

    public function test_import_dry_run_reports_diff_without_writing(): void
    {
        $file = UploadedFile::fake()->createWithContent(
            'terms.json',
            json_encode(['terms' => [['term' => 'Preview Only']]])
        );

        $response = $this->post('/api/v1/vocabulary/import?format=json&dryRun=1', ['file' => $file], $this->authHeaders());

        $response->assertOk();
        $response->assertJsonPath('dryRun', true);
        $response->assertJsonPath('created', 1);

        $this->getJson('/api/v1/vocabulary', $this->authHeaders())->assertJsonCount(0, 'terms');
    }

    public function test_import_rejects_file_larger_than_5mb(): void
    {
        $file = UploadedFile::fake()->create('huge.csv', 5121);

        $this->post('/api/v1/vocabulary/import?format=csv', ['file' => $file], $this->authHeaders())
            ->assertUnprocessable();
    }

    public function test_import_rejects_unknown_csv_column(): void
    {
        $file = UploadedFile::fake()->createWithContent('terms.csv', "term,bogus\nSomething,x\n");

        $response = $this->post('/api/v1/vocabulary/import?format=csv', ['file' => $file], $this->authHeaders());

        $response->assertUnprocessable();
        $response->assertJsonPath('code', 'validation_failed');

        $this->getJson('/api/v1/vocabulary', $this->authHeaders())->assertJsonCount(0, 'terms');
    }

    public function test_import_rejects_malformed_rows_listing_row_numbers_and_writes_nothing(): void
    {
        $csv = "term,kind\nGood Term,custom\n,custom\nAlso Good,bogus-kind\n";
        $file = UploadedFile::fake()->createWithContent('terms.csv', $csv);

        $response = $this->post('/api/v1/vocabulary/import?format=csv', ['file' => $file], $this->authHeaders());

        $response->assertUnprocessable();
        $rowErrors = $response->json('rowErrors');
        $this->assertIsArray($rowErrors);
        $this->assertStringContainsString('Row 2', $rowErrors[0]);
        $this->assertStringContainsString('Row 3', $rowErrors[1]);

        // Nothing partially written despite one valid row in the file.
        $this->getJson('/api/v1/vocabulary', $this->authHeaders())->assertJsonCount(0, 'terms');
    }

    public function test_import_requires_editor_role(): void
    {
        \App\Models\User::query()->firstOrCreate(
            ['email' => 'viewer@example.test'],
            ['name' => 'Viewer', 'password' => Hash::make('secret-password'), 'role' => 'viewer']
        );
        $viewerToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'viewer@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $file = UploadedFile::fake()->createWithContent('terms.json', json_encode(['terms' => []]));

        $this->post('/api/v1/vocabulary/import?format=json', ['file' => $file], ['Authorization' => 'Bearer '.$viewerToken])
            ->assertForbidden();
    }

    public function test_export_allows_any_authenticated_role(): void
    {
        \App\Models\User::query()->firstOrCreate(
            ['email' => 'viewer2@example.test'],
            ['name' => 'Viewer2', 'password' => Hash::make('secret-password'), 'role' => 'viewer']
        );
        $viewerToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'viewer2@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->getJson('/api/v1/vocabulary/export?format=json', ['Authorization' => 'Bearer '.$viewerToken])
            ->assertOk();
    }
}
