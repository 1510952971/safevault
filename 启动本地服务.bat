@echo off
chcp 65001 >nul
echo ========================================================
echo         SafeVault 个人私密密码保险箱启动程序
echo ========================================================
echo.
echo 正在启动本地开发/局域网服务并自动打开浏览器...
echo 启动后可在电脑浏览器或手机通过局域网 IP:3000 访问。
echo.
start http://localhost:3000
call npm.cmd run dev -- --host 0.0.0.0 --port 3000 --open
pause
