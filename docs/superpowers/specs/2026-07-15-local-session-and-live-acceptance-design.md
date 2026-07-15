# Local Session and Live Acceptance Design

## Goal

Make the documented local `Setup-Archive.bat quick` path usable in a browser without weakening the refresh-token boundary, then validate the canonical Laravel + Next application through a real administrator journey.

## Authentication model

- Keep `va_refresh` HttpOnly and scoped to `/api/v1/auth/refresh`; it remains the only cookie accepted to mint an API access token.
- Add a distinct, opaque HttpOnly session-presence cookie scoped to `/`. It is only a Next proxy routing hint: it never authenticates Laravel API requests and is cleared with the refresh cookie on logout.
- Login and refresh responses set both cookies. The Next proxy gates protected pages on the presence cookie, while the browser session provider continues to obtain its bearer token through `/auth/refresh`.
- Production still requires secure cookies. The documented local HTTP path writes `ARCHIVE_SECURE_COOKIES=false` only for a loopback HTTP URL; HTTPS deployments retain `true`.

## Setup behavior

- `Setup-Archive.bat quick` remains the Windows entrypoint.
- When the configured app URL is loopback HTTP, deploy normalizes the local cookie flag before Compose starts. Existing explicit HTTPS or non-loopback configuration is not weakened.
- Lifecycle commands (`status`, `start`, `health`, and `logs`) use the source Compose adapter when `ARCHIVE_DEVELOPMENT_MODE=1`, rather than requiring a signed-release installation manifest.

## Acceptance scope

The live administrator journey must prove: local startup and health; login and persistence after reload; type/classification setup; record creation or upload; metadata and taxonomy assignment; exact search retrieval; audio upload; actual transcription job completion; and rendered transcript visibility. Test data is uniquely named and cleaned up when supported by the UI/API; a genuine processor failure is reported as a failure.

## Error handling and verification

- Unit/feature tests assert cookie scope, secure-flag selection, and local lifecycle adapter selection.
- A live Playwright workflow verifies login navigation and reload.
- The operator acceptance report records each user-visible result and distinguishes unavailable external processing from application defects.
