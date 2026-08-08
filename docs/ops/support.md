# Operations and support

[العربية](support.ar.md) · [Documentation](../README.md)

Use this guide to collect safe diagnostic information, assess impact, and
recover Archive Suite without exposing archive data or credentials.

## Before troubleshooting

1. Record the application version, runtime mode (`docker` or `native`), host
   platform, and the time with its time zone.
2. Run `node scripts/control-center.mjs health` and review `status` and `logs`.
3. Confirm that a recent backup exists before restarting, updating, or restoring.
4. Reproduce the issue with synthetic data when possible.

## What to include in a support request

- A short description of the impact and the affected page or operation.
- Reproduction steps and the expected and observed results.
- The user role involved, without names or personal data.
- A redacted log excerpt or support bundle.

Never attach `.env`, database dumps, access tokens, connection strings, secret
keys, or real archive documents to a public request.

## Severity

| Severity | Example | First action |
| --- | --- | --- |
| Critical | Data exposure, data loss, or total outage | Contain access, stop unsafe writes, preserve evidence |
| High | Core operation unavailable with no safe workaround | Collect diagnostics and assign an owner |
| Normal | Limited defect with a safe workaround | Record reproduction details and plan the correction |

## Safe recovery

Create and verify a backup before any restore. A restore replaces current data
and requires explicit confirmation. After recovery, run the health check and
verify sign-in, search, one record read, and the backup schedule.

Use [Control Center](../control-center.md) for supported maintenance commands and
the [deployment guide](../../DEPLOYMENT.md) for public endpoint configuration.
