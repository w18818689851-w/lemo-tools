@echo off
rem ============================================================
rem  lemo console launcher (Windows)
rem
rem  Starts `node server.mjs` and lets the SERVER open the browser.
rem  It does NOT touch lemo-make.mjs - the CLI keeps working
rem  exactly the same when this console is not running.
rem
rem  Port: default 7788. Override:  start-console.bat 18080
rem
rem  NOTE on ports (this machine): 7788 falls inside a Windows
rem  "excluded port range" (Hyper-V/WSL reserves 7699-7798), so
rem  binding it fails with EACCES. That is NOT a conflict.
rem  server.mjs handles the two cases differently:
rem    EACCES     -> scans forward for a bindable port and prints
rem                  a banner saying which port it actually used.
rem    EADDRINUSE -> refuses to start (exit 3). It never switches
rem                  ports on a real conflict, because that would
rem                  silently start a second instance.
rem  The excluded ranges CHANGE ON EVERY REBOOT, so this launcher
rem  no longer hard-codes a fallback port.
rem
rem  The browser is opened by server.mjs (--open), NOT here:
rem  only the server knows the port it actually bound.
rem
rem  This file is deliberately ASCII-only + CRLF: cmd.exe
rem  mis-parses batch files that contain multi-byte characters
rem  or LF-only line endings. The Chinese UI lives in web/.
rem ============================================================
setlocal
cd /d "%~dp0"

set "PORT=7788"
if not "%~1"=="" set "PORT=%~1"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [x] node not found. Install Node 20+ and make sure it is on PATH.
  echo.
  pause
  exit /b 1
)

node server.mjs --port %PORT% --open
set "RC=%ERRORLEVEL%"

echo.
echo   Console exited ^(code %RC%^)
echo.
pause
endlocal
exit /b 0
