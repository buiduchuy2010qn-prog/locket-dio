@echo off
cd /d "%~dp0"
set PORT=4200
echo Starting Huy Locket (SPA + API proxy)...
start "locket-dio-server" cmd /c "set PORT=4200&& node server.mjs"
timeout /t 2 /nobreak >nul
if exist "%TEMP%\cloudflared\cloudflared.exe" (
  echo Opening Cloudflare public URL...
  "%TEMP%\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:4200
) else (
  echo Install cloudflared or open http://127.0.0.1:4200
  start http://127.0.0.1:4200
)
pause
