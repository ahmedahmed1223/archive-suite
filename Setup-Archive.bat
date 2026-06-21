@echo off
REM Archive Suite — Windows Control Center.
REM Double-click this file (or run from a terminal) to open the management console:
REM   install/deploy, start/stop/restart servers, health, diagnostics, config, backup.
REM Pass a subcommand to run it non-interactively, e.g.  Setup-Archive.bat status

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Node.js not found. Install Node 22+ from https://nodejs.org then re-run.
  echo.
  pause
  exit /b 1
)

node "scripts\control-center.mjs" %*

echo.
pause
