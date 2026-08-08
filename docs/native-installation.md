# Native installation

[العربية](native-installation.ar.md) · [Documentation](README.md)

Archive Suite supports native deployment on Windows and Linux in addition to Docker.
Native packages run the same Laravel and Next.js services without a container
runtime on the target host.

## Build a package

Build on a prepared build machine. Docker is used while assembling the portable
Laravel runtime but is not required on the target host.

```powershell
pnpm bundle:windows-native -- --out=D:\MasarNative
```

```bash
pnpm bundle:linux-native -- --out=/srv/masar-native
```

Keep the generated `SHA256SUMS` file with the package and verify it before
transferring the package to an installation host.

## Requirements

- Windows 10 or 11, or Linux with `systemd`.
- Reachable PostgreSQL and Redis services for the application data plane.
- Protected configuration for service credentials and the public application URL.

The package manages its application services. Use the supported backup and
restore workflow before maintenance. See [platform support](platform-parity.md)
and [operations](ops/support.md).
