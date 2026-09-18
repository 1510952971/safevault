# SafeVault NAS 私有化部署指南

SafeVault 是一款**零知识架构（Zero-Knowledge）**的个人私密密码保险箱。所有加解密运算均在您访问时的**手机端/电脑浏览器本地内存**中完成，NAS 仅作为私有静态 Web 服务宿主，因此：
- **绝对安全**：即使 NAS 被局域网他人扫描，也绝对无法窃取您的密码明文；
- **全离线可用**：完全无需外网，断网时已打开的 PWA 依然可在手机上正常使用与加解密；
- **跨端体验**：手机浏览器访问后，点击“添加到主屏幕”，秒变移动端原生小程序界面。

---

## 方式一：Docker Compose 一键部署（推荐）

适用于群晖 DSM 7.2+（Container Manager）、威联通、绿联私有云、极空间等支持 Docker 的 NAS。

### 1. 拷贝文件
将本工程目录整体上传或通过 git clone 至 NAS 的某个目录，例如 `/volume1/docker/safevault`。

### 2. 启动容器
进入该目录，终端执行：
```bash
docker compose up -d --build
```
或者在群晖 Container Manager 的“项目（Project）”中，选择此目录下的 `docker-compose.yml` 点击“构建并启动”。

### 3. 访问系统
在内网任何手机、平板、电脑的浏览器输入：
```text
http://<你的NAS局域网IP>:8088
```
例如：`http://192.168.1.100:8088`

---

## 方式二：静态文件直接托管（免 Docker，极速轻量）

如果您使用的是群晖 Web Station、绿联静态站点、Nginx 或 Caddy，甚至无需运行 Docker：

1. 本地执行打包：
   ```powershell
   npm run build
   ```
2. 打包后会生成 `dist/` 文件夹。
3. 将 `dist/` 文件夹内的全部内容，复制到 NAS 的 Web 静态发布目录（如 `/volume1/web/safevault`）。
4. 在 NAS Web Station 中将端口映射到该目录即可直接访问！

---

## 方式三：手机端配置为“沉浸式小程序”（PWA）

1. **iOS（苹果手机 Safari 浏览器）**：
   - 使用 Safari 打开 `http://<NAS_IP>:8088`；
   - 点击浏览器底部中间的 **“分享”** 按钮；
   - 向下滚动找到并点击 **“添加到主屏幕”**；
   - 桌面即刻生成 **SafeVault** 图标，打开后无浏览器地址栏，全屏沉浸如同原生小程序。

2. **Android（安卓手机 Chrome / Edge / 系统浏览器）**：
   - 使用浏览器打开链接；
   - 点击右上角菜单 `...`；
   - 选择 **“添加到主屏幕”** 或 **“安装应用”**。

---

## 安全备份建议
请在应用内定期点击左侧/底部的 **“安全备份”** 按钮，导出 `.safevault.json` 备份文件，保存在电脑或 NAS 的另外安全目录中。
