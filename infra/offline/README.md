# Install Archive Suite offline

[العربية](README.ar.md) · [Documentation](../../docs/README.md)

Archive Suite provides transferable installation artifacts for Docker and
direct-host operation (Native). This directory contains the Docker offline
bundle format. Native bundles are built with the platform commands documented
in the [Native installation guide](../../docs/native-installation.md).

## Docker bundle

1. Download the bundle and `SHA256SUMS` from the same release.
2. Verify `SHA256SUMS` before extraction with `sha256sum --check SHA256SUMS` on
   Linux or `Get-FileHash` on Windows.
3. Transfer the complete directory to the isolated host.
4. Run `sh install.sh` on Linux or `.\install.ps1` in Windows PowerShell.
5. Review the protected `.env`, start the supplied `compose.v1.yml`, and verify health.

The installer verifies every bundled file and image before calling
`docker load`; it does not require a registry connection.

## Update and recovery

Create and verify a backup before updating. Stop the current services without
deleting volumes, load the new bundle, and start it. Laravel applies schema
changes through `archive:migrate-safe`.

If an update fails, restore the database and storage backup that matches the
previous version before starting that version again. Do not run an older
application against a newer incompatible schema.

## Uninstall

```bash
docker compose --env-file .env -f compose.v1.yml down
```

Add `--volumes` only when you intentionally want to delete persistent data and
have already verified a backup. See the [installation guide](../../INSTALL.md)
and [deployment guide](../../DEPLOYMENT.md) for operating procedures.
