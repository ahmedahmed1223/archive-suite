<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordsBulkCsvTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    private function seedRecord(string $uid, array $overrides = []): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode([
                'uid' => $uid,
                'id' => $uid,
                'title' => $overrides['title'] ?? "Title {$uid}",
                'description' => $overrides['description'] ?? 'Some description',
                'type' => $overrides['type'] ?? 'video',
                'subtype' => $overrides['subtype'] ?? 'interview',
                'status' => $overrides['status'] ?? 'draft',
                'tags' => $overrides['tags'] ?? ['news', 'daily'],
            ], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function test_export_streams_csv_of_top_level_fields(): void
    {
        $this->seedRecord('item-1');

        $response = $this->get('/api/v1/records/export?store=archive-items', $this->authHeaders());

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $content = $response->streamedContent();
        $this->assertStringContainsString('uid,title,description,type,subtype,status,tags', $content);
        $this->assertStringContainsString('item-1,Title item-1,Some description,video,interview,draft,news;daily', $content);
    }

    public function test_export_allows_any_authenticated_role(): void
    {
        $this->seedRecord('item-1');

        \App\Models\User::query()->firstOrCreate(
            ['email' => 'viewer-csv@example.test'],
            ['name' => 'Viewer', 'password' => Hash::make('secret-password'), 'role' => 'viewer']
        );
        $viewerToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'viewer-csv@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->get('/api/v1/records/export?store=archive-items', ['Authorization' => 'Bearer '.$viewerToken])
            ->assertOk();
    }

    public function test_import_updates_only_rows_whose_uid_exists(): void
    {
        $this->seedRecord('item-1');

        $csv = "uid,title,description,type,subtype,status,tags\n"
            .'item-1,Updated Title,Updated desc,video,segment,published,alpha;beta'."\n"
            .'item-missing,Ghost,,,,,'."\n";
        $file = UploadedFile::fake()->createWithContent('records.csv', $csv);

        $response = $this->post('/api/v1/records/import?store=archive-items', ['file' => $file], $this->authHeaders());

        $response->assertOk();
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('accepted', 1);
        $response->assertJsonPath('rejected', 1);
        $response->assertJsonPath('results.0.uid', 'item-1');
        $response->assertJsonPath('results.0.accepted', true);
        $response->assertJsonPath('results.1.uid', 'item-missing');
        $response->assertJsonPath('results.1.accepted', false);
        $response->assertJsonPath('results.1.reason', 'not_found');

        $row = DB::table('storage_rows')->where('store', 'archive-items')->where('uid', 'item-1')->first();
        $data = json_decode((string) $row->data, true);
        $this->assertSame('Updated Title', $data['title']);
        $this->assertSame(['alpha', 'beta'], $data['tags']);

        $this->assertDatabaseMissing('storage_rows', ['store' => 'archive-items', 'uid' => 'item-missing']);
    }

    public function test_import_never_creates_new_uids(): void
    {
        $csv = "uid,title\n".'brand-new,Should Not Exist'."\n";
        $file = UploadedFile::fake()->createWithContent('records.csv', $csv);

        $this->post('/api/v1/records/import?store=archive-items', ['file' => $file], $this->authHeaders())
            ->assertOk();

        $this->assertDatabaseMissing('storage_rows', ['store' => 'archive-items', 'uid' => 'brand-new']);
    }

    public function test_import_does_not_touch_fields_absent_from_csv_header(): void
    {
        $this->seedRecord('item-1', ['description' => 'Original description']);

        // header omits "description" entirely -- it must survive untouched.
        $csv = "uid,title\n".'item-1,New Title Only'."\n";
        $file = UploadedFile::fake()->createWithContent('records.csv', $csv);

        $this->post('/api/v1/records/import?store=archive-items', ['file' => $file], $this->authHeaders())
            ->assertOk();

        $row = DB::table('storage_rows')->where('store', 'archive-items')->where('uid', 'item-1')->first();
        $data = json_decode((string) $row->data, true);
        $this->assertSame('New Title Only', $data['title']);
        $this->assertSame('Original description', $data['description']);
    }

    public function test_import_dry_run_reports_without_writing(): void
    {
        $this->seedRecord('item-1');

        $csv = "uid,title\n".'item-1,Dry Run Title'."\n";
        $file = UploadedFile::fake()->createWithContent('records.csv', $csv);

        $response = $this->post('/api/v1/records/import?store=archive-items&dryRun=1', ['file' => $file], $this->authHeaders());

        $response->assertOk();
        $response->assertJsonPath('dryRun', true);
        $response->assertJsonPath('accepted', 1);

        $row = DB::table('storage_rows')->where('store', 'archive-items')->where('uid', 'item-1')->first();
        $data = json_decode((string) $row->data, true);
        $this->assertNotSame('Dry Run Title', $data['title']);
    }

    public function test_import_rejects_file_larger_than_5mb(): void
    {
        $file = UploadedFile::fake()->create('huge.csv', 5121);

        $this->post('/api/v1/records/import?store=archive-items', ['file' => $file], $this->authHeaders())
            ->assertUnprocessable();
    }

    public function test_import_rejects_unknown_csv_column(): void
    {
        $file = UploadedFile::fake()->createWithContent('records.csv', "uid,bogus\nitem-1,x\n");

        $response = $this->post('/api/v1/records/import?store=archive-items', ['file' => $file], $this->authHeaders());

        $response->assertUnprocessable();
        $response->assertJsonPath('code', 'validation_failed');
    }

    public function test_import_rejects_malformed_rows_listing_row_numbers_and_writes_nothing(): void
    {
        $this->seedRecord('item-1');

        $csv = "uid,title\nitem-1,Good Row\n,Missing Uid\n";
        $file = UploadedFile::fake()->createWithContent('records.csv', $csv);

        $response = $this->post('/api/v1/records/import?store=archive-items', ['file' => $file], $this->authHeaders());

        $response->assertUnprocessable();
        $rowErrors = $response->json('rowErrors');
        $this->assertIsArray($rowErrors);
        $this->assertStringContainsString('Row 2', $rowErrors[0]);

        $row = DB::table('storage_rows')->where('store', 'archive-items')->where('uid', 'item-1')->first();
        $data = json_decode((string) $row->data, true);
        $this->assertNotSame('Good Row', $data['title']);
    }

    public function test_import_requires_editor_role(): void
    {
        \App\Models\User::query()->firstOrCreate(
            ['email' => 'viewer-import@example.test'],
            ['name' => 'Viewer', 'password' => Hash::make('secret-password'), 'role' => 'viewer']
        );
        $viewerToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'viewer-import@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $file = UploadedFile::fake()->createWithContent('records.csv', "uid,title\nitem-1,x\n");

        $this->post('/api/v1/records/import?store=archive-items', ['file' => $file], ['Authorization' => 'Bearer '.$viewerToken])
            ->assertForbidden();
    }
}
