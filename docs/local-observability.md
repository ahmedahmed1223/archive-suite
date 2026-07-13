# Local observability and support diagnostics

The canonical Docker stack uses Docker's `local` logging driver for every
service. Each container log rotates at **10 MB** and retains **5 files**. Caddy
access logs, Next request events, Laravel nginx access logs, and Laravel
web/worker/Reverb application logs are JSON. `X-Request-ID` is propagated by
Caddy and Next into Laravel; an invalid or missing value is replaced with a
UUID, logged, and returned to the caller.

Run `setup observability` on Windows or `./setup.sh observability` on Linux to
print local JSON alerts. The check covers stopped services, Redis queue depth,
host disk pressure, backup age/RPO, and repeated error-level log entries. It
also publishes one readiness result combining the existing deep DB/Redis/storage
API probe with worker and Reverb process health. Docker, Redis, log, or deep
health probe failures are critical `unknown` results, never zero/healthy. Error
events must be structured, timestamped, and within the configured 60-minute
window. Defaults are queue 100, disk 85%, backup age 24 hours, and five error
events; configure `OBS_*` keys in `infra/.env`. It does not send telemetry anywhere.

Run `setup support-bundle` or `./setup.sh support-bundle` to write a local JSON
bundle under `support-bundles/`. Recent logs are bounded to **200 lines** and
the complete bundle to **1 MB**. It includes versions, a redacted configuration
summary, health output, recent logs and the canonical Compose manifest. Secret,
password, token, credential and host-path values are redacted. Archive content,
uploaded media and user files are never collected. Review the file before
sharing it and delete it when the support case closes.

On POSIX systems the command enforces and verifies mode `0600`. On Windows it
removes inherited ACL entries, grants the current owner read/write access, and
verifies that broad Users/Everyone entries are absent. Bundle creation fails
closed and removes the artifact if either permission step fails.
