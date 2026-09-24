@echo off
setlocal enabledelayedexpansion
title SafeVault - ZSpace Package Generator

cd /d "%~dp0"

echo ========================================================
echo   SafeVault 密码数据库 - 极空间部署包一键生成器
echo ========================================================
echo.
echo [1/3] 正在执行前端生产构建 (npm run build)...
call npm.cmd run build
if %errorlevel% neq 0 (
    echo [ERROR] 前端构建失败，请检查报错信息。
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] 正在准备极空间部署目录 (deploy\zspace-package)...
set "TARGET_DIR=%~dp0deploy\zspace-package"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%TARGET_DIR%\data" mkdir "%TARGET_DIR%\data"
if not exist "%TARGET_DIR%\server" mkdir "%TARGET_DIR%\server"

echo.
echo [3/3] 正在复制编译网页产物与纯原生服务端脚本...
echo [安全] 仅同步 dist 与 server，绝不删除 data 密码数据库...
robocopy "%~dp0dist" "%TARGET_DIR%\dist" /MIR /R:2 /W:1 >nul
if %errorlevel% gtr 7 (
    echo [ERROR] dist 复制失败，请检查目标目录权限。
    pause
    exit /b 1
)
robocopy "%~dp0server" "%TARGET_DIR%\server" /MIR /R:2 /W:1 >nul
if %errorlevel% gtr 7 (
    echo [ERROR] server 复制失败，请检查目标目录权限。
    pause
    exit /b 1
)
copy /y "%~dp0package.json" "%TARGET_DIR%\" >nul
copy /y "%~dp0deploy\docker-compose.yml" "%TARGET_DIR%\" >nul

echo.
echo ========================================================
echo [成功] 极空间部署包已打包就绪！
echo 目标文件夹：%TARGET_DIR%
echo.
echo 极空间部署步骤简述：
echo 1. 将 deploy\zspace-package 中的 dist 与 server 覆盖到极空间原目录
echo 2. 严禁删除或覆盖 data 文件夹（其中保存密码数据库）
echo 3. 在极空间 Docker 中重启原 safevault 容器
echo 4. 详细步骤请参阅：docs\极空间NAS私有化部署与远程同步指南.md
echo ========================================================
echo.
pause
