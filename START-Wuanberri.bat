@echo off
title Wuanberri (local preview)
cd /d "%~dp0"
echo Serving Wuanberri at http://localhost:8123  (keep this window OPEN)
echo.
echo Opening the sign-in page (use the browser Back button to see the rest of the site).
start "" http://localhost:8123/auth.html
echo.
"%LOCALAPPDATA%\..\..\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m http.server 8123
pause