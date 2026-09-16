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

echo Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

echo Building game...
call npm run build
if errorlevel 1 goto :fail

echo Starting game...
start "Blue Stage Trivia Server" cmd /k "cd /d "%~dp0" && npm start"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"

echo Game launched at http://localhost:3000
exit /b 0

:fail
echo.
echo Setup failed. See the error above.
pause
exit /b 1
