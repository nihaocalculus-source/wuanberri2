@echo off
title Wuanberri (local preview)
cd /d "%~dp0"
echo Serving Wuanberri at http://localhost:8080  (keep this window OPEN)
start "" http://localhost:8080/settings.html
echo.
python -m http.server 8080
pause