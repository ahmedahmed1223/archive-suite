<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
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
        'GET api/v1/safety-preview/scenarios' => self::V1,
        'POST api/v1/safety-preview/run' => self::V1,

        // -- authenticated + audited: core v1 contract --
        'GET api/v1/auth/me' => self::V1,
        'POST api/v1/auth/logout' => self::V1,
        'GET api/v1/records' => self::V1,
        'POST api/v1/records' => self::V1,
        'GET api/v1/records/{id}' => self::V1,
        'GET api/v1/records/{id}/attachments' => self::V1,
        'POST api/v1/records/{id}/attachments' => self::V1,
        'DELETE api/v1/records/{id}/attachments/{attachmentId}' => self::V1,
        'PATCH api/v1/records/{id}/transcript' => self::V1,
        'GET api/v1/records/{id}/notes' => self::V1,
        'POST api/v1/records/{id}/notes' => self::V1,
        'GET api/v1/records/{id}/comments' => self::V1,
        'POST api/v1/records/{id}/comments' => self::V1,
        'GET api/v1/records/{id}/history' => self::V1,
        'GET api/v1/records/{id}/broadcast-metadata' => self::EXPERIMENTAL,
        'PUT api/v1/records/{id}/broadcast-metadata' => self::EXPERIMENTAL,
        'POST api/v1/records/bulk' => self::V1,
        'POST api/v1/records/bulk-delete' => self::V1,
        'GET api/v1/records/export' => self::V1,
        'POST api/v1/records/import' => self::V1,
        'GET api/v1/trash' => self::V1,
        'POST api/v1/trash/restore' => self::V1,
        'POST api/v1/trash/purge' => self::V1,
        'PATCH api/v1/record-notes/{id}' => self::V1,
        'DELETE api/v1/record-notes/{id}' => self::V1,
        'DELETE api/v1/record-comments/{id}' => self::V1,
        'GET api/v1/sync' => self::V1,
        'GET api/v1/activity' => self::V1,
        'GET api/v1/reports/compliance' => self::ADMIN,
        'GET api/v1/reports/compliance/export' => self::ADMIN,
        'GET api/v1/plugins' => self::ADMIN,
        'GET api/v1/search' => self::V1,
        'GET api/v1/search/suggestions' => self::V1,
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
        'POST api/v1/delegated-access' => self::V1,
        'GET api/v1/delegated-access' => self::V1,
        'DELETE api/v1/delegated-access/{id}' => self::V1,
        'POST api/v1/uploads' => self::V1,
        'POST api/v1/uploads/sessions' => self::V1,
        'GET api/v1/uploads/sessions/{sessionId}' => self::V1,
        'PUT api/v1/uploads/sessions/{sessionId}/chunks/{index}' => self::V1,
        'POST api/v1/uploads/sessions/{sessionId}/complete' => self::V1,
        'DELETE api/v1/uploads/sessions/{sessionId}' => self::V1,
        // V1-712: durable scheduled uploads.
        'POST api/v1/uploads/schedules' => self::V1,
        'GET api/v1/uploads/schedules' => self::V1,
        'GET api/v1/uploads/schedules/{id}' => self::V1,
        'PATCH api/v1/uploads/schedules/{id}' => self::V1,
        'DELETE api/v1/uploads/schedules/{id}' => self::V1,
        'POST api/v1/uploads/schedules/{id}/retry' => self::V1,
        'GET api/v1/intake-templates' => self::V1,
        'POST api/v1/intake-templates' => self::V1,
        'DELETE api/v1/intake-templates/{id}' => self::V1,
        'POST api/v1/import/preview' => self::V1,
        'GET api/v1/upload-links' => self::V1,
        'POST api/v1/upload-links' => self::V1,
        'POST api/v1/upload-links/{id}/revoke' => self::V1,
        'GET api/v1/saved-searches' => self::V1,
        'POST api/v1/saved-searches' => self::V1,
        'PATCH api/v1/saved-searches/{id}' => self::V1,
        'POST api/v1/saved-searches/{id}/copy' => self::V1,
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
        'GET api/v1/vocabulary/export' => self::V1,
        'POST api/v1/vocabulary/import' => self::V1,
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
        'GET api/v1/users/mentionable' => self::V1,
        'GET api/v1/users' => self::ADMIN,
        'POST api/v1/users' => self::ADMIN,
        'PATCH api/v1/users/{id}' => self::ADMIN,
        'DELETE api/v1/users/{id}' => self::ADMIN,
        'GET api/v1/api-keys' => self::ADMIN,
        'POST api/v1/api-keys' => self::ADMIN,
        'DELETE api/v1/api-keys/{id}' => self::ADMIN,
        'GET api/v1/webhooks' => self::ADMIN,
        'POST api/v1/webhooks' => self::ADMIN,
        'DELETE api/v1/webhooks/{id}' => self::ADMIN,
        'GET api/v1/onboarding/progress' => self::V1,
        'PATCH api/v1/onboarding/progress/{stage}' => self::ADMIN,
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
        'GET api/v1/system/metrics/history' => self::ADMIN,
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

    private const ROLE_ADMIN = 'admin';

    private const ROLE_EDITOR = 'editor';

    private const ROLE_ANY = 'any';

    /**
     * Routes with no archive.auth middleware — reachable without a bearer
     * token, so they carry no role expectation in ROLE_FIXTURE below.
     *
     * @var array<int, string>
     */
    private const PUBLIC_ROUTES = [
        'GET api/v1/health',
        'GET api/v1/public/openapi.json',
        'GET api/v1/public/catalog',
        'GET api/v1/share/{token}',
        'GET api/v1/review-links/{token}',
        'POST api/v1/invitations/{token}/accept',
        'GET api/v1/upload-links/{token}',
        'POST api/v1/auth/login',
        'POST api/v1/auth/refresh',
    ];

    /**
     * V1-102H: every authenticated /api/v1 route's expected role, using the
     * same coverage-over-Route::getRoutes() mechanism as FIXTURE above.
     * 'any' means every authenticated role (including viewer) may call it —
     * an explicit, documented choice, not an unreviewed gap. This is scope
     * distinct from FIXTURE: an ADMIN-scope route here is also role=admin
     * in every case observed so far, but EXPERIMENTAL-scope (odbc) is
     * role=admin while broadcast-metadata (also EXPERIMENTAL) is role=any —
     * scope and role are independent axes, do not assume one from the other.
     * Keep in sync with the real Controller::requireAdmin()/requireEditor()
     * calls; RoleMatrixApiTest and OdbcReadApiTest assert actual HTTP
     * behaviour for the admin/editor entries below, this file only asserts
     * that every authenticated route has *a* documented expectation.
     *
     * @var array<string, string> "METHOD uri" => admin|editor|any
     */
    private const ROLE_FIXTURE = [
        'GET api/v1/files/stream' => self::ROLE_ANY,
        'GET api/v1/collaboration/rooms/{roomKey}/presence' => self::ROLE_ANY,
        'POST api/v1/collaboration/rooms/{roomKey}/presence' => self::ROLE_ANY,
        'GET api/v1/collaboration/rooms/{roomKey}/locks' => self::ROLE_ANY,
        'POST api/v1/collaboration/rooms/{roomKey}/locks' => self::ROLE_ANY,
        'POST api/v1/collaboration/rooms/{roomKey}/locks/release' => self::ROLE_ANY,
        'GET api/v1/collaboration/rooms/{roomKey}/documents/{resourceId}' => self::ROLE_ANY,
        'POST api/v1/collaboration/rooms/{roomKey}/documents/{resourceId}' => self::ROLE_ANY,
        'GET api/v1/broadcasting/auth' => self::ROLE_ANY,
        'POST api/v1/broadcasting/auth' => self::ROLE_ANY,
        'GET api/v1/safety-preview/scenarios' => self::ROLE_EDITOR,
        'POST api/v1/safety-preview/run' => self::ROLE_EDITOR,
        'GET api/v1/auth/me' => self::ROLE_ANY,
        'POST api/v1/auth/logout' => self::ROLE_ANY,
        'GET api/v1/records' => self::ROLE_ANY,
        'POST api/v1/records' => self::ROLE_EDITOR,
        'GET api/v1/records/{id}' => self::ROLE_ANY,
        'GET api/v1/records/{id}/attachments' => self::ROLE_ANY,
        'POST api/v1/records/{id}/attachments' => self::ROLE_EDITOR,
        'DELETE api/v1/records/{id}/attachments/{attachmentId}' => self::ROLE_EDITOR,
        'PATCH api/v1/records/{id}/transcript' => self::ROLE_EDITOR,
        'GET api/v1/records/{id}/notes' => self::ROLE_ANY,
        'POST api/v1/records/{id}/notes' => self::ROLE_ANY,
        'GET api/v1/records/{id}/comments' => self::ROLE_ANY,
        'POST api/v1/records/{id}/comments' => self::ROLE_ANY,
        'GET api/v1/records/{id}/history' => self::ROLE_ANY,
        'GET api/v1/records/{id}/broadcast-metadata' => self::ROLE_ANY,
        'PUT api/v1/records/{id}/broadcast-metadata' => self::ROLE_ANY,
        'POST api/v1/records/bulk' => self::ROLE_EDITOR,
        'POST api/v1/records/bulk-delete' => self::ROLE_EDITOR,
        // V1-714: export is a read, like GET /records; import writes existing
        // rows, same bar as records/bulk.
        'GET api/v1/records/export' => self::ROLE_ANY,
        'POST api/v1/records/import' => self::ROLE_EDITOR,
        // V1-731: browsing the trash is a read, like GET /records. Restore is
        // the editor's own undo; purge is the only irreversible step, so it
        // escalates to admin.
        'GET api/v1/trash' => self::ROLE_ANY,
        'POST api/v1/trash/restore' => self::ROLE_EDITOR,
        'POST api/v1/trash/purge' => self::ROLE_ADMIN,
        'PATCH api/v1/record-notes/{id}' => self::ROLE_ANY,
        'DELETE api/v1/record-notes/{id}' => self::ROLE_ANY,
        'DELETE api/v1/record-comments/{id}' => self::ROLE_ANY,
        'GET api/v1/sync' => self::ROLE_ANY,
        'GET api/v1/activity' => self::ROLE_ANY,
        'GET api/v1/reports/compliance' => self::ROLE_ADMIN,
        'GET api/v1/reports/compliance/export' => self::ROLE_ADMIN,
        'GET api/v1/plugins' => self::ROLE_ADMIN,
        'GET api/v1/search' => self::ROLE_ANY,
        'GET api/v1/search/suggestions' => self::ROLE_ANY,
        'GET api/v1/discover' => self::ROLE_ANY,
        'GET api/v1/suggestions' => self::ROLE_ANY,
        'PUT api/v1/suggestions/{key}/feedback' => self::ROLE_ANY,
        'GET api/v1/relations/graph' => self::ROLE_ANY,
        'POST api/v1/relations' => self::ROLE_EDITOR,
        'PATCH api/v1/relations/{id}' => self::ROLE_EDITOR,
        'DELETE api/v1/relations/{id}' => self::ROLE_EDITOR,
        'GET api/v1/files' => self::ROLE_ANY,
        'GET api/v1/files/browser' => self::ROLE_ANY,
        'GET api/v1/media/jobs' => self::ROLE_ANY,
        'POST api/v1/media/jobs' => self::ROLE_ANY,
        'GET api/v1/media/jobs/{id}' => self::ROLE_ANY,
        'POST api/v1/media/jobs/{id}/cancel' => self::ROLE_ANY,
        'GET api/v1/montage-projects' => self::ROLE_ANY,
        'POST api/v1/montage-projects' => self::ROLE_EDITOR,
        'GET api/v1/montage-projects/{id}' => self::ROLE_ANY,
        'PUT api/v1/montage-projects/{id}' => self::ROLE_EDITOR,
        'DELETE api/v1/montage-projects/{id}' => self::ROLE_EDITOR,
        'POST api/v1/share' => self::ROLE_EDITOR,
        'GET api/v1/rights/expiring' => self::ROLE_ANY,
        'GET api/v1/rights/{itemId}/enforcement' => self::ROLE_ANY,
        'GET api/v1/rights' => self::ROLE_ANY,
        'POST api/v1/rights' => self::ROLE_EDITOR,
        'POST api/v1/delegated-access' => self::ROLE_EDITOR,
        'GET api/v1/delegated-access' => self::ROLE_ANY,
        'DELETE api/v1/delegated-access/{id}' => self::ROLE_ANY,
        'POST api/v1/uploads' => self::ROLE_ANY,
        'POST api/v1/uploads/sessions' => self::ROLE_ANY,
        'GET api/v1/uploads/sessions/{sessionId}' => self::ROLE_ANY,
        'PUT api/v1/uploads/sessions/{sessionId}/chunks/{index}' => self::ROLE_ANY,
        'POST api/v1/uploads/sessions/{sessionId}/complete' => self::ROLE_ANY,
        'DELETE api/v1/uploads/sessions/{sessionId}' => self::ROLE_ANY,
        // V1-712: durable scheduled uploads — all require editor (or admin);
        // viewer is forbidden. List/show/reschedule/cancel/retry are further
        // scoped to the caller's own rows inside the controller (admin sees
        // all) — that ownership scoping isn't expressible in this route-role
        // fixture, so it's covered by ScheduledUploadApiTest instead.
        'POST api/v1/uploads/schedules' => self::ROLE_EDITOR,
        'GET api/v1/uploads/schedules' => self::ROLE_EDITOR,
        'GET api/v1/uploads/schedules/{id}' => self::ROLE_EDITOR,
        'PATCH api/v1/uploads/schedules/{id}' => self::ROLE_EDITOR,
        'DELETE api/v1/uploads/schedules/{id}' => self::ROLE_EDITOR,
        'POST api/v1/uploads/schedules/{id}/retry' => self::ROLE_EDITOR,
        'GET api/v1/intake-templates' => self::ROLE_ANY,
        'POST api/v1/intake-templates' => self::ROLE_ANY,
        'DELETE api/v1/intake-templates/{id}' => self::ROLE_ANY,
        'POST api/v1/import/preview' => self::ROLE_ANY,
        'GET api/v1/upload-links' => self::ROLE_ANY,
        'POST api/v1/upload-links' => self::ROLE_EDITOR,
        'POST api/v1/upload-links/{id}/revoke' => self::ROLE_EDITOR,
        'GET api/v1/saved-searches' => self::ROLE_ANY,
        'POST api/v1/saved-searches' => self::ROLE_ANY,
        'PATCH api/v1/saved-searches/{id}' => self::ROLE_ANY,
        'POST api/v1/saved-searches/{id}/copy' => self::ROLE_ANY,
        'DELETE api/v1/saved-searches/{id}' => self::ROLE_ANY,
        'GET api/v1/collections' => self::ROLE_ANY,
        'POST api/v1/collections' => self::ROLE_EDITOR,
        'DELETE api/v1/collections/{id}' => self::ROLE_EDITOR,
        'GET api/v1/inbox' => self::ROLE_ANY,
        'POST api/v1/inbox' => self::ROLE_ANY,
        'PATCH api/v1/inbox/{id}' => self::ROLE_ANY,
        'DELETE api/v1/inbox/{id}' => self::ROLE_ANY,
        'GET api/v1/vocabulary' => self::ROLE_ANY,
        'POST api/v1/vocabulary' => self::ROLE_EDITOR,
        'DELETE api/v1/vocabulary/{id}' => self::ROLE_EDITOR,
        'GET api/v1/vocabulary/export' => self::ROLE_ANY,
        'POST api/v1/vocabulary/import' => self::ROLE_EDITOR,
        'GET api/v1/tag-nodes' => self::ROLE_ANY,
        'POST api/v1/tag-nodes' => self::ROLE_EDITOR,
        'PATCH api/v1/tag-nodes/{id}' => self::ROLE_EDITOR,
        'DELETE api/v1/tag-nodes/{id}' => self::ROLE_EDITOR,
        'POST api/v1/tag-nodes/reorder' => self::ROLE_EDITOR,
        'POST api/v1/tag-nodes/{id}/merge' => self::ROLE_EDITOR,
        'POST api/v1/tag-nodes/{id}/move' => self::ROLE_EDITOR,
        'GET api/v1/types' => self::ROLE_ANY,
        'POST api/v1/types' => self::ROLE_EDITOR,
        'GET api/v1/types/{id}' => self::ROLE_ANY,
        'DELETE api/v1/types/{id}' => self::ROLE_EDITOR,
        'POST api/v1/types/{id}/check-field-acl' => self::ROLE_ANY,
        'GET api/v1/automation/rules' => self::ROLE_ANY,
        'POST api/v1/automation/rules' => self::ROLE_EDITOR,
        'PATCH api/v1/automation/rules/{id}' => self::ROLE_EDITOR,
        'DELETE api/v1/automation/rules/{id}' => self::ROLE_EDITOR,
        'POST api/v1/automation/rules/{id}/run' => self::ROLE_EDITOR,
        'GET api/v1/users/mentionable' => self::ROLE_ANY,
        'GET api/v1/users' => self::ROLE_ADMIN,
        'POST api/v1/users' => self::ROLE_ADMIN,
        'PATCH api/v1/users/{id}' => self::ROLE_ADMIN,
        'DELETE api/v1/users/{id}' => self::ROLE_ADMIN,
        'GET api/v1/api-keys' => self::ROLE_ADMIN,
        'POST api/v1/api-keys' => self::ROLE_ADMIN,
        'DELETE api/v1/api-keys/{id}' => self::ROLE_ADMIN,
        'GET api/v1/webhooks' => self::ROLE_ADMIN,
        'POST api/v1/webhooks' => self::ROLE_ADMIN,
        'DELETE api/v1/webhooks/{id}' => self::ROLE_ADMIN,
        'GET api/v1/onboarding/progress' => self::ROLE_ANY,
        'PATCH api/v1/onboarding/progress/{stage}' => self::ROLE_ADMIN,
        'POST api/v1/ingest/scan' => self::ROLE_EDITOR,
        'POST api/v1/ingest/ftp/pull' => self::ROLE_EDITOR,
        'POST api/v1/ingest/smb/pull' => self::ROLE_EDITOR,
        'GET api/v1/media/{mediaUid}/review-comments' => self::ROLE_ANY,
        'POST api/v1/media/{mediaUid}/review-comments' => self::ROLE_ANY,
        'POST api/v1/media/{mediaUid}/review-links' => self::ROLE_ANY,
        'PATCH api/v1/review-comments/{id}' => self::ROLE_ANY,
        'GET api/v1/system/odbc' => self::ROLE_ADMIN,
        'GET api/v1/system/odbc/tables/{table}' => self::ROLE_ADMIN,
        'POST api/v1/system/odbc/tables/{table}/rows' => self::ROLE_ADMIN,
        'PATCH api/v1/system/odbc/tables/{table}/rows' => self::ROLE_ADMIN,
        'DELETE api/v1/system/odbc/tables/{table}/rows' => self::ROLE_ADMIN,
        'GET api/v1/system/security-settings' => self::ROLE_ADMIN,
        'PATCH api/v1/system/security-settings' => self::ROLE_ADMIN,
        'POST api/v1/system/test-storage' => self::ROLE_ADMIN,
        'POST api/v1/system/test-database' => self::ROLE_ADMIN,
        'GET api/v1/system/backups' => self::ROLE_ADMIN,
        'POST api/v1/system/backups/run' => self::ROLE_ADMIN,
        'POST api/v1/system/backups/preview' => self::ROLE_ADMIN,
        'POST api/v1/system/backups/restore' => self::ROLE_ADMIN,
        'POST api/v1/system/backups/verify' => self::ROLE_ADMIN,
        'POST api/v1/system/backups/dr-drill' => self::ROLE_ADMIN,
        'GET api/v1/system/backups/dr-status' => self::ROLE_ADMIN,
        'GET api/v1/system/status' => self::ROLE_ADMIN,
        'GET api/v1/system/metrics/history' => self::ROLE_ADMIN,
        'GET api/v1/system/dr-probe' => self::ROLE_ADMIN,
        'POST api/v1/system/control/{action}' => self::ROLE_ADMIN,
        'GET api/v1/account/export' => self::ROLE_ANY,
        'GET api/v1/notifications' => self::ROLE_ANY,
        'GET api/v1/notifications/{id}' => self::ROLE_ANY,
        'POST api/v1/notifications/{id}/read' => self::ROLE_ANY,
        'POST api/v1/notifications/{id}/unread' => self::ROLE_ANY,
        'POST api/v1/notifications/mark-all-read' => self::ROLE_ANY,
        'DELETE api/v1/notifications/{id}' => self::ROLE_ANY,
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

    // -- V1-102H: role coverage gate --

    public function test_every_authenticated_route_has_expected_role_coverage(): void
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

                if (in_array($key, self::PUBLIC_ROUTES, true)) {
                    continue;
                }

                if (! array_key_exists($key, self::ROLE_FIXTURE)) {
                    $missing[] = $key;
                }
            }
        }

        $this->assertSame(
            [],
            $missing,
            'Authenticated /api/v1 route(s) missing expected role coverage — add to '
                .'RouteScopeTest::ROLE_FIXTURE with admin/editor/any, or to PUBLIC_ROUTES '
                .'if genuinely unauthenticated: '.implode(', ', $missing)
        );
    }

    public function test_role_fixture_has_no_stale_entries(): void
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

        $stale = array_values(array_diff(array_keys(self::ROLE_FIXTURE), array_keys($registered)));

        $this->assertSame([], $stale, 'ROLE_FIXTURE references route(s) no longer registered: '.implode(', ', $stale));
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

        // V1-102G: ODBC is admin-only, not just feature-flagged — authHeaders()
        // is editor-role (see AuthenticatesArchiveRequests) and would now 403.
        $this->getJson('/api/v1/system/odbc', $this->adminHeaders())
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

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'route-scope-admin@example.test'],
            [
                'name' => 'Route Scope Admin',
                'password' => Hash::make('secret-password'),
                'role' => 'admin',
            ],
        );

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
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
