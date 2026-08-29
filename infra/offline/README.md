# Install Archive Suite offline

[العربية](README.ar.md) · [Documentation](../../docs/README.md)

Archive Suite provides transferable installation artifacts for Docker and
direct-host operation (Native). This directory contains the Docker offline
bundle format. Native bundles are built with the platform commands documented
in the [Native installation guide](../../docs/native-installation.md).

## Docker bundle

1. Download every bundle part plus `SHA256SUMS` and `OFFLINE-BUNDLE-SHA256`
   from the same release. Do not proceed if a part such as `.part-00` or
   `.part-01` is missing.
2. Verify the downloaded assets with `sha256sum --check SHA256SUMS` on Linux,
   or compare `Get-FileHash` output with the matching line on Windows.
3. Reassemble the parts before extracting. On Linux or macOS:

   ```bash
   cat archive-suite-offline-v1.5.1.tar.gz.part-* > archive-suite-offline-v1.5.1.tar.gz
   sha256sum --check OFFLINE-BUNDLE-SHA256
   ```

   On Windows CMD:

   ```cmd
   copy /b "archive-suite-offline-v1.5.1.tar.gz.part-00"+"archive-suite-offline-v1.5.1.tar.gz.part-01" "archive-suite-offline-v1.5.1.tar.gz"
   ```

   Then run `Get-FileHash .\archive-suite-offline-v1.5.1.tar.gz -Algorithm SHA256`
   and compare it with `OFFLINE-BUNDLE-SHA256`. Add later parts in the same order.
4. Extract only after verification, for example:
   `tar -xzf archive-suite-offline-v1.5.1.tar.gz`.
5. Transfer the complete extracted directory to the isolated host, then run
   `sh install.sh` on Linux or `.\install.ps1` in Windows PowerShell.
6. Review the protected `.env`, start the supplied `compose.v1.yml`, and verify health.

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
