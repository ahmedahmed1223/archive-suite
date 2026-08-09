# Native support policy

[العربية](native-support.ar.md) · [Documentation](README.md)

Archive Suite officially supports direct-host deployment on Windows and Linux.
Native packages run the canonical Laravel and Next.js services without Docker
on the target host.

## Included data-service baseline

- PostgreSQL is available as a managed local service with `pgvector` and
  pgAdmin, or it can point to an operator-managed external PostgreSQL endpoint.
- Redis is optional. The default database queue and cache baseline works without
  Redis; an external Redis-compatible service can be selected when required.
- The setup process creates protected application and database credentials. Do
  not publish the generated configuration or secret files.

## Operating scope

Windows Native requires Windows 10 or 11 and administrator approval when the
installer registers services. Linux Native requires `systemd` and the
corresponding system privileges. Each release continues to receive issue
triage and corrective updates through the normal support window.

See [Native installation](native-installation.md) for package assembly and
operator steps, and [support operations](ops/support.md) for incident reports.
