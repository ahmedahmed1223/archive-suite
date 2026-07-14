# V1-208M — data service and storage probes

## Scope

- Added `scripts/control-center/data-probes.mjs`: injectable, non-destructive PostgreSQL, Redis-compatible, and storage probes for Setup/runtime adapters.
- PostgreSQL uses only the fixed read-only statement `SELECT 1 AS archive_probe`.
- Redis and storage use generated `archive-setup-probe-*` namespaces and always attempt namespace-scoped cleanup after success, failure, or timeout.
- Probe outcomes use the stable JSON-safe shape `ok`, `code`, `message`, `details`, `nextActions`; driver exception text is deliberately not returned or logged.

## TDD evidence

1. Added `data-probes.test.mjs` before the implementation; it failed because `data-probes.mjs` did not exist.
2. Implemented the smallest adapter-based probe module.
3. Corrected the adapter checks so failure/timeout still enter cleanup after a key/path has been generated.
4. Independent review found that a backend could ignore timeout cancellation and complete a late write after the first cleanup. Added RED regressions for delayed Redis `set` and storage `write`, then passed an `AbortSignal` to all adapter calls and scheduled a second namespace-scoped cleanup after a late completion. Added RED regressions for Redis/storage cleanup failure; the probes now return redacted `*_CLEANUP_FAILED` outcomes instead of reporting ready/unavailable/timeout.

## Verification

- `node --test scripts/control-center/data-probes.test.mjs` — 11 passing, 0 failing.
- `node --check scripts/control-center/data-probes.mjs` — passing.
- `git diff --check` — passing.
- Combined Control Center/adapter/probe run reached 59/60; the unrelated `confirmed JSON migration executes through the manifest-backed release Compose runtime` test is currently blocked by local Docker credential/daemon access (`C:\Users\LAPTOP PC WORLD\.docker\config.json`, npipe permission denied). The focused probe suite is green.
- `pnpm verify:infra` not rerun: known local gate blocker is Node `v24.15.0` outside the repository's `>=22.13.0 <23` contract plus unavailable Docker credential/config access and unsupported local `compose --env-file` behavior.
