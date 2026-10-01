@echo off
setlocal
title SafeVault - ZSpace Package Generator

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
echo   SafeVault 密码数据库 - 极空间部署包一键生成器
echo ========================================================
echo.
echo [1/3] 正在执行前端生产构建 (npm run build)...
call npm.cmd run build
if errorlevel 1 (
    echo [ERROR] 前端构建失败，请检查报错信息。
    pause
    exit /b 1
)

echo.
echo [2/3] 正在准备极空间部署目录 (deploy\zspace-package)...
set "TARGET_DIR=%~dp0deploy\zspace-package"
if exist "%TARGET_DIR%" rmdir /s /q "%TARGET_DIR%"
mkdir "%TARGET_DIR%"
mkdir "%TARGET_DIR%\data"
mkdir "%TARGET_DIR%\server"

echo.
echo [3/3] 正在复制编译网页产物与纯原生服务端脚本...
xcopy /e /i /y "%~dp0dist" "%TARGET_DIR%\dist" >nul
xcopy /e /i /y "%~dp0server" "%TARGET_DIR%\server" >nul
copy /y "%~dp0package.json" "%TARGET_DIR%\" >nul
copy /y "%~dp0deploy\docker-compose.yml" "%TARGET_DIR%\" >nul

echo.
echo ========================================================
echo [成功] 极空间部署包已打包就绪！
echo 目标文件夹：%TARGET_DIR%
echo.
echo 极空间部署步骤简述：
echo 1. 将 deploy\zspace-package 整个文件夹上传到极空间（如 Docker/safevault）
echo 2. 在极空间 Docker 中基于 node:20-alpine 镜像挂载启动
echo 3. 详细极空间图形化配置步骤请参阅：docs\NAS_DEPLOY.md
echo ========================================================
echo.
pause
