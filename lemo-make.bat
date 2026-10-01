@echo off
REM ============================================================
REM  lemo-make.bat — lemo-opuscar 一键出片（Windows GPU 渲染）
REM
REM  用法:  lemo-make.bat <demo-slug> [选项]
REM  例:    lemo-make.bat ascii-crt
REM         lemo-make.bat ukiyoe --fps 30 --workers 8
REM         lemo-make.bat ascii-crt --render-only
REM  帮助:  lemo-make.bat --help
REM ============================================================

setlocal enableextensions
chcp 65001 >nul 2>&1
set "PYTHONIOENCODING=utf-8"

set "TOOLS=%~dp0"
set "SCRIPT=%TOOLS%lemo-make.mjs"

if not exist "%SCRIPT%" (
  echo [错误] 找不到 %SCRIPT%
  exit /b 1
)

REM ---- 找 node：先 PATH，再托管运行时 ----
set "NODE="
where node >nul 2>&1 && set "NODE=node"
if not defined NODE (
  for %%P in (
    "C:\Users\Admin\.workbuddy-ai\binaries\node\versions\22.22.2-3\node.exe"
    "C:\Program Files\nodejs\node.exe"
  ) do (
    if not defined NODE if exist %%P set "NODE=%%~P"
  )
)
if not defined NODE (
  echo [错误] 找不到 node.exe。请安装 Node 20+ 或修改本脚本里的路径。
  exit /b 1
)

"%NODE%" "%SCRIPT%" %*
exit /b %errorlevel%
