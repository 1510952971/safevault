@echo off
setlocal
chcp 65001 >nul
title SafeVault - 本地服务

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
echo         SafeVault 个人私密密码数据库启动程序
echo ========================================================
echo.
echo 正在启动本地开发/局域网服务并自动打开浏览器...
echo 启动后可在电脑浏览器或手机通过局域网 IP:3000 访问。
echo 项目目录：%CD%
echo.
REM 不要在服务启动前固定打开 3000：端口被占用时 Vite 会自动切换端口，
REM 由 Vite 的 --open 打开最终实际端口。
call npm.cmd run dev -- --host 0.0.0.0 --port 3000 --open
if errorlevel 1 (
    echo.
    echo [错误] 本地服务启动失败，请查看上方日志。
)
pause
