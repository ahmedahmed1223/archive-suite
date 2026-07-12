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
  echo       Install Node.js 22+ from https://nodejs.org, then run this file again.
  echo.
  goto :fail
)

for /f "usebackq delims=" %%v in (`node -p "process.versions.node.split('.')[0]" 2^>nul`) do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR (
  echo.
  echo   [X] Could not read the installed Node.js version.
  echo.
  goto :fail
)

if %NODE_MAJOR% LSS 22 (
  echo.
  echo   [X] Node.js 22+ is required. Found:
  node -v
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
