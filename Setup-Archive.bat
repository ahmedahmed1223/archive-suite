@echo off
REM Archive Suite — Windows one-click guided deployment.
REM Double-click this file (or run from a terminal) to launch the wizard.
REM It checks Docker, generates secrets, and brings up the PostgreSQL stack.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Node.js not found. Install Node 22+ from https://nodejs.org then re-run.
  echo.
  pause
  exit /b 1
)

node "scripts\deploy-wizard.mjs" %*

echo.
pause
