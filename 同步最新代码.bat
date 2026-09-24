@echo off
setlocal enabledelayedexpansion
title SafeVault - 同步最新代码

cd /d "%~dp0"

echo ========================================================
echo       SafeVault - 从 GitHub 同步最新项目
echo ========================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [错误] 当前目录不是 Git 项目，请确认脚本位于项目根目录。
    pause
    exit /b 1
)

for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if not "!CURRENT_BRANCH!"=="main" (
    echo [错误] 当前分支是 !CURRENT_BRANCH!，规范要求在 main 分支同步。
    echo 请先备份本地修改，再切换到 main 分支。
    pause
    exit /b 1
)

for /f "delims=" %%S in ('git status --porcelain') do set "HAS_CHANGES=1"
if defined HAS_CHANGES (
    echo [错误] 当前电脑有未提交修改，已停止同步以避免覆盖本地工作。
    echo 请先提交、备份或处理这些修改后再运行本脚本。
    git status --short
    pause
    exit /b 1
)

echo [1/3] 正在从 GitHub 拉取 main 最新代码...
git pull --ff-only origin main
if errorlevel 1 (
    echo [错误] 拉取失败。可能存在分支分叉或网络问题，请保留现场后人工处理。
    pause
    exit /b 1
)

echo.
echo [2/3] 正在按 package-lock.json 恢复依赖...
call npm.cmd ci
if errorlevel 1 (
    echo [错误] 依赖安装失败。
    pause
    exit /b 1
)

echo.
echo [3/3] 正在构建最新前端资源...
call npm.cmd run build
if errorlevel 1 (
    echo [错误] 项目构建失败。
    pause
    exit /b 1
)

echo.
echo [完成] 当前版本：
git log -1 --oneline
echo.
echo 桌面端可运行“启动桌面客户端.bat”；极空间更新请运行“生成极空间部署包.bat”。
pause
