@echo off
cd /d "%~dp0"
echo ========================================
echo   HUY LOCKET API  (port 5007)
echo ========================================
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
if not exist .env.development (
  echo Copying .env.example to .env.development...
  copy /Y .env.example .env.development
)
set NODE_ENV=development
node app.js
pause
