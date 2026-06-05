# Multi-Port Cloud Design

## Goal

Make the cloud backend cover sessions, files, and polling sync without mixing responsibilities or forcing the offline IndexedDB app path through server-only code.

## Scope

This feature is delivered as one coordinated branch across `archive-core`, `archive-server`, and `archive-app`, but each subsystem remains independently testable:

- `SessionProvider`: a new core port for login/logout/current cloud identity/token state.
- `FileStore`: extended with `getBlob` so server-backed upload and download are part of the same contract as local blobs.
- `SyncProvider`: keeps the existing pure merge/conflict methods and adds cloud HTTP transport adapters for `pushChange` and `pullSince`; realtime remains the next roadmap item.

## Architecture

`archive-core` owns contracts only. It adds `SessionProvider` and extends `FileStore` with `getBlob`, then exports registry getters/register functions for sessions.

`archive-server` registers cloud storage, file, sync, and auth/session-supporting endpoints. Files are stored on disk under a configured directory. Sync polling is intentionally simple: the server accepts pushed record changes and can return video records with `syncVersion` greater than a numeric cursor.

`archive-app` registers local providers in local mode and cloud providers in cloud mode. Cloud login flows through the new `SessionProvider`; cloud file operations call `/api/files`; cloud sync operations call `/api/sync/*`. Existing local login, IndexedDB storage, and offline sync behavior remain unchanged.

## Non-Goals

- No WebSocket or PocketBase realtime in this slice.
- No large media streaming UI changes.
- No new AI provider.
- No breaking of local/offline data paths.

## Testing

- Core contract tests prove `SessionProvider` and the extended `FileStore` contract.
- Server API tests prove file upload/download/delete/list and sync push/pull under Bearer auth.
- App module tests prove cloud session registration, cloud file adapter requests, and cloud sync adapter requests.
- Existing verify/build gates must remain green in all touched repositories.
