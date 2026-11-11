@echo off
title Biometric Device Backend (Port 5050 & 1884)
echo =======================================================
echo   Starting Biometric Backend API & MQTT Broker...
echo   Backend REST API:  http://localhost:5050
echo   MQTT Broker Port:  1884
echo   Device MAC:        2002F43005D3
echo.
echo   NOTE: Open the Frontend at http://localhost:3000
echo =======================================================
cd /d "%~dp0server"
call npx nodemon src\index.js
pause

