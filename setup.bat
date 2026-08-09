@echo off
setlocal EnableExtensions

REM Archive Suite - Windows Control Center launcher.
REM Operates the canonical Laravel + Next.js stack (infra/docker-compose.yml).
REM Usage:
REM   setup.bat                  (interactive menu)
REM   setup.bat deploy           (provision .env + docker compose up -d --build)
REM   setup.bat status | start | stop | health | logs
REM   setup.bat generate-password
REM   setup.bat change-admin-password --generate
REM
REM The documented Setup-Archive.bat file calls this launcher.

cd /d "%~dp0"

set "ARCHIVE_PAUSE=0"
if "%~1"=="" set "ARCHIVE_PAUSE=1"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Node.js was not found.
  echo       Install Node.js from https://nodejs.org, then run this file again.
  echo.
  goto :fail
)

REM infra/platform/toolchain.v1.json is the single source of truth for the
REM minimum Node version (mirrored by scripts/node-version.mjs); read it
REM through that module instead of hardcoding a number here.
node -e "import('./scripts/node-version.mjs').then(({isSupportedNodeVersion, MIN_NODE_VERSION}) => { if (!isSupportedNodeVersion()) { console.error('  [X] Node ' + MIN_NODE_VERSION.split('.')[0] + '+ required (found ' + process.version + ').'); process.exit(1); } })"
if errorlevel 1 (
  echo.
  goto :fail
)

node "scripts\control-center.mjs" %*
set "ARCHIVE_EXIT=%ERRORLEVEL%"

if not "%ARCHIVE_EXIT%"=="0" (
  echo.
  echo   [X] Control Center exited with code %ARCHIVE_EXIT%.
  goto :finish
)

goto :finish

:fail
set "ARCHIVE_EXIT=1"

:finish
if "%ARCHIVE_PAUSE%"=="1" (
  echo.
  pause
)
exit /b %ARCHIVE_EXIT%
