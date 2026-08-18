# Native installation

[العربية](native-installation.ar.md) · [Documentation](README.md)

Archive Suite `v1.1.0` provides supported Windows and Linux packages that run
the canonical Laravel and Next.js services without Docker on the target host.

## Download and verify

Download the package for your platform, its acceptance evidence, and
`SHA256SUMS` from the public `v1.1.0` GitHub Release. Verify the inventory before
extracting or running any file:

```powershell
Get-FileHash .\archive-suite-v1.1.0-windows-native.tar.gz -Algorithm SHA256
```

```bash
sha256sum --check SHA256SUMS
```

Compare the Windows value with the matching line in `SHA256SUMS`. Do not use a
package when the checksum differs or when its platform acceptance evidence is
absent.

## Requirements

- Windows 10 or 11 with administrator approval for service registration, or a
  Linux distribution using `systemd` with equivalent system privileges.
- At least the resource baseline shown in [platform support](platform-parity.md).
- A managed PostgreSQL installation supplied by the Windows package, or an
  operator-managed PostgreSQL endpoint with `pgvector`. Redis is optional.
- A protected data directory, application URL, and service credentials. Never
  publish generated environment or secret files.

## Install and verify

Extract the archive into a new directory, open Control Center from that
directory, and choose `native` with the matching platform. Run the read-only
preflight before allowing installation:

```powershell
node scripts/control-center.mjs doctor
node scripts/control-center.mjs wizard
```

After installation, run `node scripts/control-center.mjs health` and confirm
that the application, API, worker, scheduler, realtime service, PostgreSQL, and
selected optional services report healthy. Keep the release archive and
`SHA256SUMS` until the next verified backup.

## Upgrade and recovery

Create and verify a backup before updating. Keep the previous package until the
new version passes health checks and a representative search, upload, and media
operation. Use Control Center for update, rollback, backup, restore, and
uninstall so cleanup remains limited to paths recorded in the installation
manifest. See [operations](ops/support.md) and [Whisper](whisper.md).

Database migrations run automatically as part of `update`; they only add
tables and columns and do not rewrite or drop existing data, so no manual
data migration step is required. If a health check or representative
operation fails after updating, restore the verified backup taken before the
update rather than attempting to roll the schema back manually.
