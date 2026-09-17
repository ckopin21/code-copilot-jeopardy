@echo off
setlocal
cd /d "%~dp0"
title Blue Stage Trivia Launcher

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run the game.
  echo Install the LTS version from https://nodejs.org/
  pause
  exit /b 1
)

echo Checking dependencies...
call npm ls --depth=0 >nul 2>nul
if errorlevel 1 (
  echo Installing locked dependencies...
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto :fail
)

echo Building game...
call npm run build
if errorlevel 1 goto :fail

echo Starting game...
start "Blue Stage Trivia" cmd /k "npm start"
timeout /t 3 /nobreak >nul

set "HOST_ADDR=localhost"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$c=Get-NetIPConfiguration ^| Where-Object {$_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up'} ^| Select-Object -First 1; if($c -and $c.IPv4Address){$c.IPv4Address.IPAddress}else{'localhost'}"`) do set "HOST_ADDR=%%I"
set "GAME_URL=http://%HOST_ADDR%:3000"
start "" "%GAME_URL%"

echo Game launched at %GAME_URL%
echo Opening the LAN address lets phone QR links point back to this computer.
exit /b 0

:fail
echo.
echo Setup failed. See the error above.
pause
exit /b 1
