@echo off
setlocal enabledelayedexpansion
title SafeVault - ZSpace Docker Image Builder

echo ========================================================
echo   SafeVault 密码数据库 - 极空间 Docker 镜像导出工具
echo ========================================================
echo.
echo 提示：此工具需要电脑已启动 Docker Desktop。
echo 若未启动 Docker Desktop，建议使用 "生成极空间部署包.bat"（免电脑安装 Docker）。
echo.
echo 正在检查本地 Docker 运行状态...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 检测到 Docker Desktop 尚未启动或后台引擎未就绪。
    echo 请先启动 Docker Desktop，或使用 "生成极空间部署包.bat" 免本地 Docker 方案。
    pause
    exit /b 1
)

echo.
echo [1/2] 正在构建 Docker 镜像 (safevault:latest)...
docker build -t safevault:latest -f "%~dp0deploy\Dockerfile" "%~dp0"
if %errorlevel% neq 0 (
    echo [ERROR] 镜像构建失败，请检查上方日志。
    pause
    exit /b 1
)

echo.
echo [2/2] 正在导出镜像为极空间可直接导入的 tar 包 (safevault-zspace.tar)...
docker save -o "%~dp0safevault-zspace.tar" safevault:latest
if %errorlevel% neq 0 (
    echo [ERROR] 镜像导出失败。
    pause
    exit /b 1
)

echo.
echo ========================================================
echo [成功] 极空间离线镜像包已导出！
echo 文件路径：%~dp0safevault-zspace.tar
echo.
echo 极空间导入步骤：
echo 1. 将 safevault-zspace.tar 上传至极空间个人空间
echo 2. 打开极空间电脑客户端 -「Docker」-「本地镜像」-「导入镜像」
echo 3. 选择 safevault-zspace.tar，点击导入即可一键创建容器！
echo ========================================================
echo.
pause
