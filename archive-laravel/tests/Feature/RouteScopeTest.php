<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V1-001: scope lock. Every route registered under /api/v1 must be
 * classified (v1 | admin | experimental | hidden) in the fixture below, kept
 * in sync with docs/scope/v1-route-scope.md. New routes fail this test until
 * classified — same coverage-over-Route::getRoutes() trick as
 * RoleMatrixApiTest (V1-102) uses for role coverage.
 */
class RouteScopeTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    private const V1 = 'v1';

    private const ADMIN = 'admin';

    private const EXPERIMENTAL = 'experimental';

    /**
     * @var array<string, string> "METHOD uri" => scope
     */
    private const FIXTURE = [
        // -- public --
        'GET api/v1/health' => self::V1,
        'GET api/v1/public/openapi.json' => self::V1,
        'GET api/v1/public/catalog' => self::V1,
        'GET api/v1/share/{token}' => self::V1,
        'GET api/v1/review-links/{token}' => self::V1,
        'POST api/v1/invitations/{token}/accept' => self::V1,
        'GET api/v1/upload-links/{token}' => self::V1,
        'POST api/v1/auth/login' => self::V1,
        'POST api/v1/auth/refresh' => self::V1,

        // -- authenticated, no audit --
        'GET api/v1/files/stream' => self::V1,
        'GET api/v1/collaboration/rooms/{roomKey}/presence' => self::V1,
        'POST api/v1/collaboration/rooms/{roomKey}/presence' => self::V1,
        'GET api/v1/collaboration/rooms/{roomKey}/locks' => self::V1,
        'POST api/v1/collaboration/rooms/{roomKey}/locks' => self::V1,
        'POST api/v1/collaboration/rooms/{roomKey}/locks/release' => self::V1,
        'GET api/v1/collaboration/rooms/{roomKey}/documents/{resourceId}' => self::V1,
        'POST api/v1/collaboration/rooms/{roomKey}/documents/{resourceId}' => self::V1,
        'GET api/v1/broadcasting/auth' => self::V1,
        'POST api/v1/broadcasting/auth' => self::V1,

        // -- authenticated + audited: core v1 contract --
        'GET api/v1/auth/me' => self::V1,
        'POST api/v1/auth/logout' => self::V1,
        'GET api/v1/records' => self::V1,
        'GET api/v1/records/{id}' => self::V1,
        'GET api/v1/records/{id}/notes' => self::V1,
        'POST api/v1/records/{id}/notes' => self::V1,
        'GET api/v1/records/{id}/comments' => self::V1,
        'POST api/v1/records/{id}/comments' => self::V1,
        'GET api/v1/records/{id}/history' => self::V1,
        'GET api/v1/records/{id}/broadcast-metadata' => self::EXPERIMENTAL,
        'PUT api/v1/records/{id}/broadcast-metadata' => self::EXPERIMENTAL,
        'POST api/v1/records/bulk' => self::V1,
        'POST api/v1/records/bulk-delete' => self::V1,
        'PATCH api/v1/record-notes/{id}' => self::V1,
        'DELETE api/v1/record-notes/{id}' => self::V1,
        'DELETE api/v1/record-comments/{id}' => self::V1,
        'GET api/v1/sync' => self::V1,
        'GET api/v1/activity' => self::V1,
        'GET api/v1/reports/compliance' => self::ADMIN,
        'GET api/v1/reports/compliance/export' => self::ADMIN,
        'GET api/v1/plugins' => self::ADMIN,
        'GET api/v1/search' => self::V1,
        'GET api/v1/discover' => self::V1,
        'GET api/v1/suggestions' => self::V1,
        'PUT api/v1/suggestions/{key}/feedback' => self::V1,
        'GET api/v1/relations/graph' => self::V1,
        'POST api/v1/relations' => self::V1,
        'PATCH api/v1/relations/{id}' => self::V1,
        'DELETE api/v1/relations/{id}' => self::V1,
        'GET api/v1/files' => self::V1,
        'GET api/v1/files/browser' => self::V1,
        'GET api/v1/media/jobs' => self::V1,
        'POST api/v1/media/jobs' => self::V1,
        'GET api/v1/media/jobs/{id}' => self::V1,
        'POST api/v1/media/jobs/{id}/cancel' => self::V1,
        'GET api/v1/montage-projects' => self::V1,
        'POST api/v1/montage-projects' => self::V1,
        'GET api/v1/montage-projects/{id}' => self::V1,
        'PUT api/v1/montage-projects/{id}' => self::V1,
        'DELETE api/v1/montage-projects/{id}' => self::V1,
        'POST api/v1/share' => self::V1,
        'GET api/v1/rights/expiring' => self::V1,
        'GET api/v1/rights/{itemId}/enforcement' => self::V1,
        'GET api/v1/rights' => self::V1,
        'POST api/v1/rights' => self::V1,
        'POST api/v1/uploads' => self::V1,
        'GET api/v1/intake-templates' => self::V1,
        'POST api/v1/intake-templates' => self::V1,
        'DELETE api/v1/intake-templates/{id}' => self::V1,
        'POST api/v1/import/preview' => self::V1,
        'GET api/v1/upload-links' => self::V1,
        'POST api/v1/upload-links' => self::V1,
        'POST api/v1/upload-links/{id}/revoke' => self::V1,
        'GET api/v1/saved-searches' => self::V1,
        'POST api/v1/saved-searches' => self::V1,
        'DELETE api/v1/saved-searches/{id}' => self::V1,
        'GET api/v1/collections' => self::V1,
        'POST api/v1/collections' => self::V1,
        'DELETE api/v1/collections/{id}' => self::V1,
        'GET api/v1/inbox' => self::V1,
        'POST api/v1/inbox' => self::V1,
        'PATCH api/v1/inbox/{id}' => self::V1,
        'DELETE api/v1/inbox/{id}' => self::V1,
        'GET api/v1/vocabulary' => self::V1,
        'POST api/v1/vocabulary' => self::V1,
        'DELETE api/v1/vocabulary/{id}' => self::V1,
        'GET api/v1/tag-nodes' => self::V1,
        'POST api/v1/tag-nodes' => self::V1,
        'PATCH api/v1/tag-nodes/{id}' => self::V1,
        'DELETE api/v1/tag-nodes/{id}' => self::V1,
        'POST api/v1/tag-nodes/reorder' => self::V1,
        'POST api/v1/tag-nodes/{id}/merge' => self::V1,
        'POST api/v1/tag-nodes/{id}/move' => self::V1,
        'GET api/v1/types' => self::V1,
        'POST api/v1/types' => self::V1,
        'GET api/v1/types/{id}' => self::V1,
        'DELETE api/v1/types/{id}' => self::V1,
        'POST api/v1/types/{id}/check-field-acl' => self::V1,
        'GET api/v1/automation/rules' => self::V1,
        'POST api/v1/automation/rules' => self::V1,
        'PATCH api/v1/automation/rules/{id}' => self::V1,
        'DELETE api/v1/automation/rules/{id}' => self::V1,
        'POST api/v1/automation/rules/{id}/run' => self::V1,
        'GET api/v1/users' => self::ADMIN,
        'POST api/v1/users' => self::ADMIN,
        'PATCH api/v1/users/{id}' => self::ADMIN,
        'DELETE api/v1/users/{id}' => self::ADMIN,
        'POST api/v1/ingest/scan' => self::V1,
        'POST api/v1/ingest/ftp/pull' => self::V1,
        'POST api/v1/ingest/smb/pull' => self::V1,
        'GET api/v1/media/{mediaUid}/review-comments' => self::V1,
        'POST api/v1/media/{mediaUid}/review-comments' => self::V1,
        'POST api/v1/media/{mediaUid}/review-links' => self::V1,
        'PATCH api/v1/review-comments/{id}' => self::V1,
        'GET api/v1/system/odbc' => self::EXPERIMENTAL,
        'GET api/v1/system/odbc/tables/{table}' => self::EXPERIMENTAL,
        'POST api/v1/system/odbc/tables/{table}/rows' => self::EXPERIMENTAL,
        'PATCH api/v1/system/odbc/tables/{table}/rows' => self::EXPERIMENTAL,
        'DELETE api/v1/system/odbc/tables/{table}/rows' => self::EXPERIMENTAL,
        'GET api/v1/system/security-settings' => self::ADMIN,
        'PATCH api/v1/system/security-settings' => self::ADMIN,
        'POST api/v1/system/test-storage' => self::ADMIN,
        'POST api/v1/system/test-database' => self::ADMIN,
        'GET api/v1/system/backups' => self::ADMIN,
        'POST api/v1/system/backups/run' => self::ADMIN,
        'POST api/v1/system/backups/preview' => self::ADMIN,
        'POST api/v1/system/backups/restore' => self::ADMIN,
        'POST api/v1/system/backups/verify' => self::ADMIN,
        'POST api/v1/system/backups/dr-drill' => self::ADMIN,
        'GET api/v1/system/backups/dr-status' => self::ADMIN,
        'GET api/v1/system/status' => self::ADMIN,
        'GET api/v1/system/dr-probe' => self::ADMIN,
        'POST api/v1/system/control/{action}' => self::ADMIN,
        'GET api/v1/account/export' => self::V1,
        'GET api/v1/notifications' => self::V1,
        'GET api/v1/notifications/{id}' => self::V1,
        'POST api/v1/notifications/{id}/read' => self::V1,
        'POST api/v1/notifications/{id}/unread' => self::V1,
        'POST api/v1/notifications/mark-all-read' => self::V1,
        'DELETE api/v1/notifications/{id}' => self::V1,
    ];

    public function test_every_registered_v1_route_is_classified(): void
    {
        $missing = [];

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1')) {
                continue;
            }

            foreach ($route->methods() as $method) {
                if ($method === 'HEAD') {
                    continue;
                }

                $key = "{$method} {$route->uri()}";

                if (! array_key_exists($key, self::FIXTURE)) {
                    $missing[] = $key;
                }
            }
        }

        $this->assertSame([], $missing, 'Unclassified /api/v1 route(s) — add to RouteScopeTest::FIXTURE and docs/scope/v1-route-scope.md: '.implode(', ', $missing));
    }

    public function test_fixture_has_no_stale_entries(): void
    {
        $registered = [];

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1')) {
                continue;
            }

            foreach ($route->methods() as $method) {
                if ($method === 'HEAD') {
                    continue;
                }

                $registered["{$method} {$route->uri()}"] = true;
            }
        }

        $stale = array_values(array_diff(array_keys(self::FIXTURE), array_keys($registered)));

        $this->assertSame([], $stale, 'Fixture references route(s) no longer registered: '.implode(', ', $stale));
    }

    // -- flag behaviour: odbc --

    public function test_odbc_route_404s_when_its_feature_flag_is_off(): void
    {
        config(['archive.features.odbc' => false]);

        $this->getJson('/api/v1/system/odbc', $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('ok', false);
    }

    public function test_odbc_route_is_reachable_when_its_feature_flag_is_on(): void
    {
        config(['archive.features.odbc' => true]);

        $this->getJson('/api/v1/system/odbc', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- flag behaviour: broadcast_metadata --

    public function test_broadcast_metadata_route_404s_when_its_feature_flag_is_off(): void
    {
        config(['archive.features.broadcast_metadata' => false]);
        $this->seedArchiveRecord();

        $this->getJson('/api/v1/records/item-1/broadcast-metadata', $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('ok', false);
    }

    public function test_broadcast_metadata_route_is_reachable_when_its_feature_flag_is_on(): void
    {
        config(['archive.features.broadcast_metadata' => true]);
        $this->seedArchiveRecord();

        $this->getJson('/api/v1/records/item-1/broadcast-metadata', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    private function seedArchiveRecord(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'item-1',
            'data' => json_encode([
                'uid' => 'item-1',
                'id' => 'item-1',
                'title' => 'Route scope fixture record',
                'type' => 'video',
                'tags' => ['scope'],
            ], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
