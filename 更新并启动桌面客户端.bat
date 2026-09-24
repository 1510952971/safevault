@echo off
setlocal enabledelayedexpansion
title SafeVault - 更新并启动桌面客户端

cd /d "%~dp0"

echo [准备] 正在关闭当前项目的旧 SafeVault 实例...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = [IO.Path]::GetFullPath('%~dp0').TrimEnd('\'); $targets = Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('electron.exe','node.exe') -and $_.CommandLine -and $_.CommandLine -like ('*' + $root + '*') -and $_.CommandLine -match 'electron' }; $targets | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

call "%~dp0同步最新代码.bat" --launch --no-pause
if errorlevel 1 (
    echo.
    echo [错误] 更新未完成，已停止启动。
    pause
    exit /b 1
)
