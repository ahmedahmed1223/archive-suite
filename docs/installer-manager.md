# Archive Suite installer and manager

[العربية](installer-manager.ar.md)

Download `Archive-Suite-Installer-Windows.zip` for Windows or `archive-suite-installer-linux.tar.gz` for Linux x64 from the release assets. Both include Node.js. Verify the published SHA256SUMS before extracting into a separate directory.

## Start

On Windows, run `Archive-Suite-Installer.bat` or `Archive-Suite-Installer.ps1`. On Linux:

```sh
./archive-suite-installer doctor --root /opt/archive-suite
./archive-suite-installer install --root /opt/archive-suite
```

The Arabic wizard checks x64 architecture, at least 8 GiB RAM and 100 GiB free disk, write access, runtime availability and required ports. Docker needs Compose and a running Linux-container daemon accessible to your account. Native needs administrator privileges on Windows, or root and systemd on Linux. The tool does not install Docker or change system permissions automatically.

## Choose a runtime

- `docker`: use the release's digest-pinned images. Recommended when Docker is ready.
- `native`: download and verify the matching operating-system package, then configure local services. Use `--source` for a local package.
- `offline`: use Docker with local release archives. Put all parts, `SHA256SUMS` and `OFFLINE-BUNDLE-SHA256` in one directory and select it with `--source`. The tool verifies each part, merges them in order, then verifies the complete archive before extraction.

Download the installer itself beforehand for disconnected use. All assets must belong to the same release. Obtain checksum inventories from the official release page.

The wizard asks for an administrator email and a hidden password of at least 12 characters. Secrets are stored in a protected configuration file. For unattended installation, provide `ARCHIVE_INSTALLER_PASSWORD` through the environment, never as a command-line argument, and unset it afterward:

```sh
./archive-suite-installer install --mode docker --root /opt/archive-suite --email owner@example.org --port 3000 --yes
```

Docker publishes the selected application port and the following port for realtime connections. Native uses port 8443 and fixed internal ports. Initial configuration is local; public domains and TLS require separate deployment configuration. Docker application files live in `storage` below the installation root; PostgreSQL data uses a project-specific Docker volume.

## Manage and repair

Use the same installer with the saved root and one of `status`, `start`, `stop`, `restart`, `logs`, `health`, `repair` or `backup`:

```sh
./archive-suite-installer health --root /opt/archive-suite
./archive-suite-installer backup --root /opt/archive-suite
./archive-suite-installer repair --root /opt/archive-suite
```

`installation.json` records the version, runtime and installation phase without credentials. Repair retries resumable setup without deleting application data. If downloading or extraction fails before configuration, retain the directory for diagnosis and choose a new directory to retry. Each root represents one installation; switching runtimes requires a separate installation and backup-based data transfer.

See the [project README](../README.md) and [management guide](control-center.md) for related operations.
