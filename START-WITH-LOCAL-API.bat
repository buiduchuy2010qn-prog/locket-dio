@echo off
cd /d "%~dp0"
echo ========================================
echo   HUY LOCKET WEB + LOCAL API
echo ========================================
echo Proxy /dio-api -^> http://127.0.0.1:5007
echo.

REM Start API in new window
start "Huy Locket API" cmd /k "cd /d C:\Users\DucHuyy\.grok\bin\huy-locket-server && set NODE_ENV=development && node app.js"

timeout /t 2 /nobreak >nul

set LOCKET_API_UPSTREAM=http://127.0.0.1:5007
set PORT=4173
echo Starting web (server.mjs) on :4173 ...
node server.mjs
pause
