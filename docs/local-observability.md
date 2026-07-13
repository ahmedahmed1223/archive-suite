# Local observability and support diagnostics

The canonical Docker stack uses Docker's `local` logging driver for every
service. Each container log rotates at **10 MB** and retains **5 files**. Caddy
access logs and Laravel web/worker/Reverb logs are JSON. Laravel responses
propagate `X-Request-ID`; an invalid incoming value is replaced with a UUID.

Run `setup observability` on Windows or `./setup.sh observability` on Linux to
print local JSON alerts. The check covers stopped services, Redis queue depth,
host disk pressure, backup age/RPO, and repeated error-level log entries. It
does not send telemetry anywhere.

Run `setup support-bundle` or `./setup.sh support-bundle` to write a local JSON
bundle under `support-bundles/`. Recent logs are bounded to **200 lines** and
the complete bundle to **1 MB**. It includes versions, a redacted configuration
summary, health output, recent logs and the canonical Compose manifest. Secret,
password, token, credential and host-path values are redacted. Archive content,
uploaded media and user files are never collected. Review the file before
sharing it and delete it when the support case closes.
