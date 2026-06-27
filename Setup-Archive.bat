@echo off
setlocal EnableExtensions

REM Archive Suite - documented Windows launcher.
REM This file exists so README/INSTALL instructions and double-click installs work.

call "%~dp0setup.bat" %*
exit /b %ERRORLEVEL%
