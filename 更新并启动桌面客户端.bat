@echo off
setlocal enabledelayedexpansion
title SafeVault - 更新并启动桌面客户端

cd /d "%~dp0"
call "%~dp0同步最新代码.bat" --launch --no-pause
if errorlevel 1 (
    echo.
    echo [错误] 更新未完成，已停止启动。
    pause
    exit /b 1
)
