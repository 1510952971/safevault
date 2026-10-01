@echo off
setlocal
title SafeVault - 桌面客户端

REM Explorer/shortcut 启动时当前目录不一定是项目目录。
cd /d "%~dp0"
if errorlevel 1 (
    echo [错误] 无法切换到项目目录：%~dp0
    pause
    exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 npm。请先安装 Node.js，并重新打开此窗口。
    pause
    exit /b 1
)

echo ========================================================
echo         SafeVault 密码数据库 - 原生桌面客户端
echo ========================================================
echo.

echo [项目目录] %CD%
echo [提示] 正在构建当前项目并启动桌面端...
call npm.cmd run desktop
if errorlevel 1 (
    echo [错误] 桌面端页面构建或启动失败。
    echo [退出码] %errorlevel%
    pause
    exit /b 1
)
