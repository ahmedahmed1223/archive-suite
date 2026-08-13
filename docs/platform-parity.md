# Platform support

[العربية](platform-parity.ar.md) · [Documentation](README.md)

Archive Suite supports Docker and native deployment on Windows and Linux. The platform
contract in `infra/platform/compatibility.v1.json` records the required runtime,
service, data-path, and port information.

| Platform | Runtime | Entry point | Requirements |
| --- | --- | --- | --- |
| Windows 10/11 | Docker | `Setup-Archive.bat` | Docker Desktop with Compose v2 |
| Linux | Docker | `setup.sh` | Docker Engine with Compose v2 |
| Windows 10/11 | Native | `pnpm bundle:windows-native` | PostgreSQL reachable by the host (Redis optional) |
| Linux | Native | `pnpm bundle:linux-native` | `systemd` and PostgreSQL (Redis optional) |

Use `node scripts/control-center.mjs doctor` before installation. Choose Docker
when the organisation operates containers; choose Native when it manages host
services directly. Both paths use the same product API, permissions, audit
trail, and backup workflow.

Read [Native installation](native-installation.md) for package requirements and
[Docker deployment](../DEPLOYMENT.md) for the Compose path.
