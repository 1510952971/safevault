# SafeVault - 个人私密密码保险箱小程序

SafeVault 是一款专为个人打造的**高安全性、零知识架构（Zero-Knowledge）、跨端轻量密码管理小程序**。  
设计严格遵循工程规范《基于大语言模型的软件与网站工程全流程精细化实操范式及 Skill 架构体系》，推行 **SPEC-First（规格优先）**、**垂直切片架构** 与 **Skill 矩阵防线**。

---

## 🌟 核心特性 (Features)

1. 🔐 **零知识强加密（Zero-Knowledge Architecture）**：
   - 采用标准底层 **Web Crypto API**；
   - 基于主密码通过 **PBKDF2-SHA256**（100,000 轮哈希计算）派生 256 位加密密钥；
   - 所有密码凭据采用 **AES-GCM-256** 独立 IV 强加密；
   - 存储介质 100% 仅存密文，严禁明文落盘。
2. 👁️ **隐私与防窥交互**：
   - 列表密码默认以脱敏小圆点 `••••••••` 呈现，支持单条点击显隐；
   - 一键复制账号与密码，复制成功后启动 **30 秒安全倒计时自动销毁剪贴板**，防止流氓软件暗中监听嗅探；
   - 3 分钟无操作**自动锁定金库**，主动清空内存中的密钥与解密缓存。
3. ⚡ **专业强密码发生器**：
   - 支持 8 ~ 32 位长度无级滑动调节；
   - 支持自由组合大写、小写、数字、特殊符号，支持排除易混淆字符；
   - 实时密码强度评分指示。
4. 🏠 **家庭私有 NAS 极简部署**：
   - 支持群晖（Synology）、威联通（QNAP）、绿联云（UGOS）、极空间等一键 Docker 部署；
   - 容器镜像基于 Alpine-Nginx，体积极小（< 25MB）；
   - 局域网/外网穿透访问，手机浏览器打开即可通过 PWA“添加到主屏幕”，享受原生小程序全屏体验。
5. 🛡️ **本地持久化与安全密文灾备**：
   - 数据 100% 保存在本地，无需外网服务器；
   - 支持一键导出/导入带有加密保护的 `.safevault.json` 备份文件。

---

## 🚀 快速开始 (Quick Start)

### 1. 本地直接运行
双击运行目录下的 **`启动本地服务.bat`**，或在终端执行：
```bash
npm install
npm run dev
```
打开浏览器访问：`http://localhost:3000`

### 2. 构建生产静态包
```bash
npm run build
```
编译产物将生成在 `dist/` 目录下，可直接放置于群晖 Web Station 或任意 Web 服务器的根目录。

### 3. NAS Docker 一键部署
进入项目目录，执行：
```bash
docker compose up -d --build
```
即可在局域网通过 `http://<NAS_IP>:8088` 访问。详细部署步骤可查阅 [NAS_DEPLOY.md](NAS_DEPLOY.md)。

### 4. 运行自动化密码学单元测试
```bash
node test-crypto.js
```

---

## 📂 项目工程架构树

```text
密码小程序/
├── .skills/                     # 专属 Skill 矩阵规范约束
│   ├── code-guardian/           # 强类型、代码完整性、异常捕获防线
│   ├── design-system/           # 视觉代币、暗黑主题、移动端优先规范
│   └── security-guardian/       # 零知识密码学与防泄露准则
├── src/
│   ├── types/
│   │   └── vault.ts             # 强类型契约定义 (SPEC 一致性)
│   ├── utils/
│   │   ├── crypto.ts            # Web Crypto API 密码学核心引擎
│   │   └── storage.ts           # 本地持久化、剪贴板安全自动清理、备份
│   ├── components/
│   │   ├── Header.tsx           # 顶部状态与功能导航栏
│   │   ├── VaultList.tsx        # 密码流式卡片、分类筛选与即时搜索
│   │   ├── PasswordCard.tsx     # 单个密码防窥脱敏卡片
│   │   ├── PasswordModal.tsx    # 密码凭据新增/编辑对话框
│   │   ├── PasswordGeneratorModal.tsx # 独立强密码发生器
│   │   ├── MasterAuthModal.tsx  # 主密码创建向导与锁屏鉴权
│   │   ├── BackupRestoreModal.tsx # 加密备份导出与校验恢复
│   │   └── Toast.tsx            # 轻量浮动交互反馈
│   ├── App.tsx                  # 核心应用状态调度与自动锁屏监听
│   ├── index.css                # 全局样式与 Tailwind 指令
│   └── main.tsx                 # 入口挂载
├── public/
│   └── manifest.json            # PWA 手机主屏幕添加到配置
├── Dockerfile                   # NAS 生产容器化多阶段构建
├── docker-compose.yml           # NAS Docker Compose 一键启动编排
├── nginx.conf                   # 安全响应头与静态加速配置
├── SPEC.md                      # 需求规格说明书 (不可动摇之最高宪法)
├── NAS_DEPLOY.md                # 专属 NAS 私有化部署图文手册
├── test-crypto.js               # 密码学套件自动化单元测试
└── package.json                 # 依赖声明与脚本
```
