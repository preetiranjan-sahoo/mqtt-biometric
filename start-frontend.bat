@echo off
title Biometric Device Vite Frontend (Port 3000)
echo =======================================================
echo   Starting Vite Frontend Dev Server with Hot-Reload...
echo   Frontend URL: http://localhost:3000
echo   API Proxy:    http://127.0.0.1:5050
echo =======================================================
cd /d "%~dp0client"
call npm run dev
pause

