@echo off
setlocal enabledelayedexpansion
title SafeVault - 桌面客户端

cd /d "%~dp0"

echo ========================================================
echo         SafeVault 密码数据库 - 原生桌面客户端
echo ========================================================
echo.

echo [提示] 正在更新桌面端页面资源并启动应用...
call npm.cmd run desktop
if errorlevel 1 (
    echo [错误] 桌面端页面构建或启动失败。
    pause
    exit /b 1
)
