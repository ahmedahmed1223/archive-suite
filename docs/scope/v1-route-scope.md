# V1-001: /api/v1 route scope lock

Classification of every route in `archive-laravel/routes/api.php` as of this
change. Scopes:

- **v1** — stable, part of the 1.0 contract.
- **admin** — stable, but admin-only (`Controller::requireAdmin()`, gate
  `manage-system`).
- **experimental** — ships, but behind a feature flag
  (`config('archive.features.*')`, env `ARCHIVE_FEATURE_<NAME>`), default
  **off** in production, default **on** in local/testing.
- **hidden** — internal/diagnostic, flag-gated, default off everywhere. None
  found — see "hidden" note at the bottom.

Coverage of this table is enforced by
`archive-laravel/tests/Feature/RouteScopeTest.php` against
`Route::getRoutes()`.

## Public (no `archive.auth`)

| Method | Route | Scope | Flag | Rationale |
|---|---|---|---|---|
| GET | `/v1/health` | v1 | — | liveness probe |
| GET | `/v1/public/openapi.json` | v1 | — | serves the shared contract file |
| GET | `/v1/public/catalog` | v1 | — | public embeddable catalog |
| GET | `/v1/share/{token}` | v1 | — | public share-link resolution, throttled |
| GET | `/v1/review-links/{token}` | v1 | — | public review-link resolution, throttled |
| POST | `/v1/invitations/{token}/accept` | v1 | — | public invite acceptance, throttled |
| GET | `/v1/upload-links/{token}` | v1 | — | public upload-link validation, throttled |
| POST | `/v1/auth/login` | v1 | — | throttled |
| POST | `/v1/auth/refresh` | v1 | — | throttled |

## Authenticated, no audit (`archive.auth` only)

| Method | Route | Scope | Flag | Rationale |
|---|---|---|---|---|
| GET | `/v1/files/stream` | v1 | — | range-capable media stream |
| GET/POST | `/v1/collaboration/rooms/{roomKey}/presence` | v1 | — | presence heartbeat |
| GET/POST | `/v1/collaboration/rooms/{roomKey}/locks` | v1 | — | doc locking |
| POST | `/v1/collaboration/rooms/{roomKey}/locks/release` | v1 | — | doc locking |
| GET/POST | `/v1/collaboration/rooms/{roomKey}/documents/{resourceId}` | v1 | — | collab doc CRDT sync |

## Authenticated + audited (`archive.auth`, `archive.audit`)

Core records/search/files/share/collections/tags surface — the 1.0 contract:

| Method | Route | Scope | Flag | Rationale |
|---|---|---|---|---|
| GET | `/v1/auth/me` | v1 | — | |
| POST | `/v1/auth/logout` | v1 | — | |
| GET/POST | `/v1/records`, `/v1/records/{id}` | v1 | — | POST creates a descriptive record; editor-gated |
| GET/POST/DELETE | `/v1/records/{id}/attachments*` | v1 | — | durable multi-file attachments; writes editor-gated |
| GET/POST | `/v1/records/{id}/notes` | v1 | — | |
| GET/POST | `/v1/records/{id}/comments` | v1 | — | |
| GET | `/v1/records/{id}/history` | v1 | — | |
| POST | `/v1/records/bulk`, `/v1/records/bulk-delete` | v1 | — | role-gated (V1-102) |
| PATCH/DELETE | `/v1/record-notes/{id}` | v1 | — | |
| DELETE | `/v1/record-comments/{id}` | v1 | — | |
| GET | `/v1/sync` | v1 | — | |
| GET | `/v1/activity` | v1 | — | |
| GET | `/v1/search` | v1 | — | |
| GET | `/v1/search/suggestions` | v1 | — | Authenticated autocomplete suggestions |
| GET | `/v1/discover` | v1 | — | mature, used by `app/discover/page.tsx` |
| GET/PUT | `/v1/suggestions`, `/v1/suggestions/{key}/feedback` | v1 | — | mature, used by `SuggestionsPanel.tsx` |
| GET/POST/PATCH/DELETE | `/v1/relations`, `/v1/relations/graph`, `/v1/relations/{id}` | v1 | — | |
| GET | `/v1/files`, `/v1/files/browser` | v1 | — | |
| GET/POST | `/v1/media/jobs`, `/v1/media/jobs/{id}`, `/v1/media/jobs/{id}/cancel` | v1 | — | ownership enforced (V1-111) |
| GET/POST/PUT/DELETE | `/v1/montage-projects*` | v1 | — | role-gated (V1-102), used by `lib/montage.ts` |
| POST | `/v1/share` | v1 | — | role-gated (V1-102) |
| GET/POST | `/v1/rights*` | v1 | — | |
| POST | `/v1/uploads` | v1 | — | |
| GET/POST/DELETE | `/v1/intake-templates*` | v1 | — | |
| POST | `/v1/import/preview` | v1 | — | |
| GET/POST | `/v1/upload-links`, `/v1/upload-links/{id}/revoke` | v1 | — | |
| GET/POST/DELETE | `/v1/saved-searches*` | v1 | — | |
| GET/POST/DELETE | `/v1/collections*` | v1 | — | |
| GET/POST/PATCH/DELETE | `/v1/inbox*` | v1 | — | |
| GET/POST/DELETE | `/v1/vocabulary*` | v1 | — | |
| GET/POST/PATCH/DELETE | `/v1/tag-nodes*` (incl. `reorder`, `merge`, `move`) | v1 | — | |
| GET/POST/DELETE | `/v1/types*`, `/v1/types/{id}/check-field-acl` | v1 | — | |
| GET/POST/PATCH/DELETE | `/v1/automation/rules*` | v1 | — | |
| POST | `/v1/ingest/scan`, `/v1/ingest/ftp/pull`, `/v1/ingest/smb/pull` | v1 | — | mature, tested (`IngestApiTest`), used by `archive-api.ts` |
| GET/POST/PATCH | `/v1/media/{mediaUid}/review-comments*`, `/v1/media/{mediaUid}/review-links`, `/v1/review-comments/{id}` | v1 | — | |
| GET | `/v1/records/{id}/broadcast-metadata` | **experimental** | `broadcast_metadata` | niche MOS/MXF broadcast-industry integration; already degrades to `configured:false` without env config, but the surface itself is flagged off by default in production per the V1-001 judgement guide |
| PUT | `/v1/records/{id}/broadcast-metadata` | **experimental** | `broadcast_metadata` | same as above |
| GET | `/v1/account/export` | v1 | — | self-service export, not admin-gated |
| GET/POST/DELETE | `/v1/notifications*` | v1 | — | |

## Admin-only (`requireAdmin()` / gate `manage-system`)

| Method | Route | Scope | Flag | Rationale |
|---|---|---|---|---|
| GET/POST/PATCH/DELETE | `/v1/users*` | admin | — | |
| GET | `/v1/reports/compliance`, `/v1/reports/compliance/export` | admin | — | |
| GET | `/v1/plugins` | admin | — | plugin marketplace management |
| GET/PATCH | `/v1/system/security-settings` | admin | — | |
| POST | `/v1/system/test-storage`, `/v1/system/test-database` | admin | — | |
| GET/POST | `/v1/system/backups*` (incl. `run`, `preview`, `restore`, `verify`, `dr-drill`, `dr-status`) | admin | — | |
| GET | `/v1/system/status`, `/v1/system/dr-probe` | admin | — | |
| POST | `/v1/system/control/{action}` | admin | — | double-gated: `archive.system_control_enabled` config + admin role |

## Experimental (flag-gated, off in production)

| Method | Route | Flag | Rationale |
|---|---|---|---|
| GET | `/v1/system/odbc` | `odbc` | probe/status |
| GET | `/v1/system/odbc/tables/{table}` | `odbc` | read |
| POST | `/v1/system/odbc/tables/{table}/rows` | `odbc` | write |
| PATCH | `/v1/system/odbc/tables/{table}/rows` | `odbc` | write |
| DELETE | `/v1/system/odbc/tables/{table}/rows` | `odbc` | write |

**Rationale (odbc):** generic external-database read/write proxy against an
allowlisted table set. Unlike every other write surface in this API, the
`SystemController::odbc*` actions carry **no `requireAdmin()`/role gate** —
any authenticated user can create/update/delete rows in the configured
external DSN. It's a real, frontend-wired feature (`archive-next` settings
page), not dead code, so it isn't "hidden" — but the combination of missing
RBAC and an inherently high-blast-radius external-DB write surface means it
should not be reachable in production until a deployment explicitly opts in.
Flagging it here is a stopgap; the missing RBAC gate is a separate concern
worth fixing directly in `SystemController` (out of scope for this route
classification change).

**Rationale (broadcast_metadata):** MOS/MXF metadata is a broadcast-industry
integration most Archive Suite deployments never touch. It's fully built and
tested (`RecordBroadcastMetadataApiTest`) and already no-ops gracefully when
`MOS_ENDPOINT`/`MXF_ENDPOINT` are unset, but per the judgement guide it's
niche enough to gate off by default in production rather than exposing an
extra always-on record-mutation endpoint for a feature almost nobody
configures.

## Hidden

None. Every internal/diagnostic surface found (`system/status`,
`system/dr-probe`, `system/control/{action}`) is already restricted via
`requireAdmin()` and, for `system/control`, an additional
`archive.system_control_enabled` config gate — that satisfies "internal,
locked down" without needing a separate always-off flag.

## Feature flags added

| Env var | Config key | Default (non-prod) | Default (prod) |
|---|---|---|---|
| `ARCHIVE_FEATURE_ODBC` | `archive.features.odbc` | `true` (local/testing) | `false` |
| `ARCHIVE_FEATURE_BROADCAST_METADATA` | `archive.features.broadcast_metadata` | `true` (local/testing) | `false` |

Enforced by `App\Http\Middleware\FeatureGate` (alias `archive.feature:<name>`),
applied as a route-group middleware in `routes/api.php`. Off returns
`404 {"ok":false,"error":"Not found."}` — an unannounced surface should look
absent, not like a 403.
