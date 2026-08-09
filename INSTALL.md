# Install Archive Suite for development

[العربية](INSTALL.ar.md) · [Documentation](docs/README.md)

Use this path when working from a clone of the repository. The supported
development stack is Next.js on the host and Laravel in Docker through
[`infra/docker-compose.yml`](infra/docker-compose.yml); local PHP and Composer
are not required.

## Requirements

- Node.js `26.5.0` and pnpm `11.9.0`
- Docker Desktop on Windows, or Docker Engine with Compose v2 on Linux

## Run the stack

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The command starts Laravel through Docker and Next.js locally. Use
`pnpm dev:next` or `pnpm dev:laravel` when only one service is needed.

Before sharing a change, run:

```bash
pnpm verify
pnpm verify:laravel-next:live
```

## First deployment on a machine

For a managed local Docker installation, open `Setup-Archive.bat` on Windows
or run `bash setup.sh` on Linux. The guided `wizard` is the recommended first
run; it can prepare secrets, start the supported Compose stack, and report its
health. See the [deployment guide](DEPLOYMENT.md) before exposing a public
endpoint.
