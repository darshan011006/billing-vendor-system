@echo off
rem Double-click to run BillDesk (Billing & Vendor Management) on http://localhost:3000
setlocal
cd /d "%~dp0"
title BillDesk - http://localhost:3000
echo.
echo === BillDesk - Next.js + PostgreSQL + MongoDB ===

set "NODE_OK=0"
where node >nul 2>nul && node -e "process.exit(+process.versions.node.split('.')[0]>=20?0:1)" && set "NODE_OK=1"
if "%NODE_OK%"=="1" goto have_node
if exist ".tools\node\node.exe" goto use_private_node
echo Node.js 20+ not found - downloading a private copy into .tools (about 30 MB)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; New-Item -ItemType Directory -Force .tools | Out-Null; Invoke-WebRequest 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip' -OutFile '.tools\node.zip'; Expand-Archive '.tools\node.zip' '.tools' -Force; Rename-Item '.tools\node-v20.18.1-win-x64' 'node'; Remove-Item '.tools\node.zip'"
if errorlevel 1 (
  echo Download failed. Install Node.js 20 LTS from https://nodejs.org and double-click this file again.
  pause
  exit /b 1
)
:use_private_node
set "PATH=%CD%\.tools\node;%PATH%"
:have_node
for /f "delims=" %%v in ('node -v') do echo Using Node %%v

if exist "node_modules\next" goto run
echo Installing packages (first run only, 1-3 minutes)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo npm install failed - see the messages above.
  pause
  exit /b 1
)

:run
rem open the browser once the app answers
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 180;$i++){try{Invoke-WebRequest 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process 'http://localhost:3000'; break}catch{Start-Sleep 2}}"
echo The first run downloads MongoDB (about 70 MB) and sets up both databases.
echo Leave this window open while you use the app. Press Ctrl+C to stop.
call npm run dev
pause
