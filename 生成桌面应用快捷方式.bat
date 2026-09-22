@echo off
setlocal enabledelayedexpansion
title SafeVault - 桌面快捷方式创建器

echo ========================================================
echo   SafeVault 密码数据库 - 创建 Windows 桌面应用快捷方式
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [Environment]::GetFolderPath('Desktop'); $ProjectDir = [IO.Path]::GetFullPath('%~dp0'); $Batch = Join-Path $ProjectDir '启动桌面客户端.bat'; $Shortcut = $WshShell.CreateShortcut((Join-Path $Desktop 'SafeVault 密码数据库.lnk')); $Shortcut.TargetPath = 'cmd.exe'; $Shortcut.Arguments = '/c start \"\" \"' + $Batch + '\"'; $Shortcut.WorkingDirectory = $ProjectDir; $Shortcut.Description = 'SafeVault 个人私密密码数据库桌面客户端'; $Shortcut.Save(); Write-Host '[成功] 已在您的 Windows 桌面上生成「SafeVault 密码数据库」快捷方式！' -ForegroundColor Green"

echo.
echo 您现在可以直接在电脑桌面上双击「SafeVault 密码数据库」图标打开桌面端应用！
echo.
pause
