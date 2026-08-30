# Native Standalone installation

[العربية](native-installation.ar.md) · [Documentation index](README.md)

Archive Suite v1.5.1 provides complete Native Standalone bundles for Windows
x64 and Linux x64. The bundle includes the canonical Laravel and Next.js
application, pinned runtimes, platform launchers, Control Center, release
metadata, checksums, and the verified data-service payload required by the
release.

## Download and verify

From the [v1.5.1 GitHub Release](https://github.com/ahmedahmed1223/archive-suite/releases/tag/v1.5.1), download exactly one platform archive, its acceptance evidence, and
the top-level `SHA256SUMS` file.

On Windows:

```powershell
Get-FileHash .\archive-suite-v1.5.1-windows-native.tar.gz -Algorithm SHA256
```

On Linux:

```bash
sha256sum --check SHA256SUMS
```

Do not extract or run an asset whose digest does not match `SHA256SUMS`, or
whose platform acceptance evidence is absent.

## Requirements

Windows requires x64 Windows and an elevated terminal. Linux requires x64 Linux,
`systemd`, root privileges for service registration, and an available `tar`
implementation. Both platforms require enough disk space for the extracted
application and the bundled data-service payload.

## Install and verify

Extract the archive into a new directory. Use the launcher at the bundle root:

```bat
install.bat
```

```bash
chmod +x install.sh manage.sh
./install.sh
```

The installer verifies the bundle inventory, asks for the Native setup choices,
creates protected configuration and secrets, registers the platform services,
runs safe migrations, and performs a health check.

With the default managed choice, the installer also initializes the bundled
PostgreSQL instance, installs the verified pgvector extension, creates the
Archive application role, and registers the bundled Redis-compatible service.
These data services are recorded in the installation manifest, so `start`,
`stop`, `restart`, `status`, and `uninstall` include them. Choose external
endpoints only when those services are operated outside the Native bundle.

## Manage the installation

`manage.bat` and `manage.sh` are the stable management entry points. They route
to the same Control Center implementation and do not contain a second service
manager:

```bat
manage.bat doctor
manage.bat status
manage.bat health
manage.bat logs
manage.bat backup
manage.bat update
manage.bat restore
manage.bat uninstall
```

```bash
./manage.sh doctor
./manage.sh status
./manage.sh health
./manage.sh logs
./manage.sh backup
./manage.sh update
./manage.sh restore
./manage.sh uninstall
```

`restore` and data deletion during `uninstall` require explicit confirmation.
Uninstall preserves the configured data and backup paths by default.

## Version and change history

Read `RELEASE.json` at the bundle root for the installed version, platform, and
UTC build time. Read `CHANGELOG.md` for the release history shipped with the
bundle. Keep `RELEASE.json` and `SHA256SUMS` with the installed package when
opening a support request.

## Upgrade and recovery

Create and verify a backup before `update`. Keep the previous package until the
new version passes `health` and representative search, upload, and media
operations. If an update fails, use the verified backup and the previous
package; do not manually roll back database schema changes.

For the split offline Docker archive, first reconstruct all
`archive-suite-offline-v1.5.1.tar.gz.part-*` files, verify
`OFFLINE-BUNDLE-SHA256`, and only then run `tar -xzf`. See
[`infra/offline/README.md`](../infra/offline/README.md).
