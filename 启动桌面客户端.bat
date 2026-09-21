@echo off
setlocal enabledelayedexpansion
title SafeVault - 桌面客户端

echo ========================================================
echo         SafeVault 密码数据库 - 原生桌面客户端
echo ========================================================
echo.

if not exist "%~dp0dist\index.html" (
    echo [提示] 首次启动正在构建客户端页面...
    call npm.cmd run build
)

echo 正在启动 SafeVault 桌面端独立窗口...
call npm.cmd run desktop
