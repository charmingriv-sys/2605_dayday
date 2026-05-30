@echo off
title 2605_dayday Web Server
echo ===================================================
echo   Starting 2605_dayday Local Server (Port 3000)
echo   Press Ctrl+C to stop the server at any time.
echo ===================================================
echo.
echo Opening http://localhost:3000 in default browser...
start "" "http://localhost:3000"
echo.
node server.js
pause
