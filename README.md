# SafeVault - 个人私密密码数据库

SafeVault 是一款专为个人打造的**高安全性、零知识架构（Zero-Knowledge）、机能战术科技风密码数据库**。  
系统严格遵循规范指南《基于大语言模型的软件与网站工程全流程精细化实操范式及 Skill 架构体系》，推行 **SPEC-First（规格优先）**、**垂直切片架构** 与 **Skill 矩阵防线**。

---

## 📂 工程清晰目录结构 (Clean Project Hierarchy)

本项目已完成清晰分层与模块化归档，文档、部署、测试与业务源码各归其位，严禁文件混杂：

```text
密码小程序/
├── docs/                      # 【设计与规范文档专区】不与代码混杂
│   ├── SafeVault_程序系统详细设计说明书.docx   # Word 工业学术排版设计说明书
│   ├── SafeVault_程序系统详细设计说明书.md     # Markdown 详细设计文档全集
│   ├── SPEC.md                                  # 阶段零需求规格说明书 (最高宪法)
│   ├── 极空间NAS私有化部署与远程同步指南.md       # NAS 私有化部署图文手册
│   ├── 多电脑协作与发布更新规范.md                # GitHub 多电脑同步与发布规范
│   └── generate_design_doc.py                   # 设计文档一键生成脚本
├── deploy/                    # 【部署配置专区】NAS / Docker 配置独立存放
│   ├── Dockerfile                               # 生产容器多阶段构建 (镜像 < 25MB)
│   ├── docker-compose.yml                       # Docker Compose 一键拉起配置
│   └── nginx.conf                               # Nginx 安全响应头与 Gzip 加速配置
├── tests/                     # 【测试套件专区】
│   └── test-crypto.js                           # 原生密码学自动化回归单元测试
├── src/                       # 【前端业务源码专区】
│   ├── types/                 # 强类型契约定义 (SPEC 一致性)
│   │   └── vault.ts
│   ├── utils/                 # 底层工具库
│   │   ├── crypto.ts          # Web Crypto API 零知识底层加密引擎
│   │   └── storage.ts         # 本地持久化、30秒安全剪贴板销毁
│   ├── components/            # 机能战术风格组件群
│   │   ├── Header.tsx         # 战术顶栏 (终端编号 #0027)
│   │   ├── Sidebar.tsx        # 01~06 竖向战术编号菜单
│   │   ├── VaultOverview.tsx  # 顶部 HUD 监控看板 (等级 1/4 比率与4列参数格)
│   │   ├── VaultList.tsx      # 核心设施与槽位列表网格
│   │   ├── PasswordCard.tsx   # 战术槽位卡片 (掩码防窥与复制)
│   │   ├── EmptySlotCard.tsx  # 建造空槽位卡片 [+]
│   │   ├── TacticalDefensePanel.tsx # 右侧防卫升级面板与推进按钮
│   │   ├── MasterAuthModal.tsx# 主密码初始化向导与锁屏鉴权
│   │   ├── PasswordModal.tsx  # 凭据录入与编辑对话框
│   │   ├── PasswordGeneratorModal.tsx # 独立强密码发生器
│   │   ├── BackupRestoreModal.tsx     # 加密备份导出与校验恢复
│   │   └── Toast.tsx          # 轻量浮动交互反馈
│   ├── App.tsx                # 核心状态调度与 3 分钟超时无操作锁屏
│   ├── index.css              # 全局机能战术点阵背景与样式
│   └── main.tsx               # 入口挂载
├── public/                    # 静态资产与 PWA 清单
│   └── manifest.json          # PWA 手机主屏幕全屏无边框配置
├── .skills/                   # 专属 Skill 矩阵守卫
│   ├── code-guardian/         # 代码完整性与强类型防护
│   ├── design-system/         # 战术视觉代币约束
│   └── security-guardian/     # 密码学安全防线
├── 启动本地服务.bat            # 根目录一键启动批处理
├── 同步最新代码.bat            # 从 GitHub 拉取、安装依赖并构建
├── 更新并启动桌面客户端.bat     # 同步后刷新旧实例并启动最新桌面端
├── package.json               # 依赖与脚本
├── tsconfig.json              # TypeScript 编译配置
├── vite.config.ts             # Vite 构建配置
└── tailwind.config.js         # Design Tokens 样式代币配置
```

---

## 🌟 核心特性 (Features)

1. 🔐 **零知识强加密（Zero-Knowledge Architecture）**：
   - 采用底层原生 **Web Crypto API**，无第三方侧信道漏洞；
   - 基于主密码通过 **PBKDF2-SHA256（100,000 轮）** 派生 256 位 AES-GCM 加密密钥；
   - 所有密码条目使用 **AES-GCM-256** 独立 12 字节随机 IV 强认证加密；
   - 存储介质 100% 仅存密文，严禁任何明文落盘。
2. 👁️ **防窥与隐私交互**：
   - 列表密码默认以脱敏掩码 `••••••••` 呈现，支持单条点击显隐；
   - 一键复制账号与密码，复制成功后启动 **30 秒安全倒计时自动销毁剪贴板**，防止流氓软件暗中监听嗅探；
   - 3 分钟无操作**自动锁定金库**，主动清空内存中的密钥与解密缓存。
3. 🎮 **机能战术科技风（对齐据点管理参考原型）**：
   - 01~06 竖向战术编号菜单（炭黑底色 + 荧光亮绿竖标 + 右侧编号）；
   - 顶部 HUD 监控看板（大字号比率 `1 / 4`、四列带绿刻度的指标格、虚线雷达环）；
   - 经典空槽位卡片：`02 空槽位 [+] 选择凭据进行录入`；
   - 斜切机能推进按钮：左侧斜切荧光黄色块 `>` + 黑色主体按钮。
4. ⚡ **专业强密码发生器**：
   - 支持 8 ~ 32 位长度无级滑动调节；
   - 支持自由组合大写、小写、数字、特殊符号，支持排除易混淆字符；
   - 实时密码强度评分指示。
5. 🏠 **家庭私有 NAS 极简部署**：
   - 支持群晖（Synology）、威联通（QNAP）、绿联云（UGOS）、极空间等一键 Docker 部署；
   - 容器镜像基于 Alpine-Nginx，体积极小（< 25MB）；
   - 手机浏览器打开即可通过 PWA“添加到主屏幕”，享受原生小程序全屏体验。
6. 🛡️ **NAS 权威存储与安全密文灾备**：
   - 账号数据统一保存在极空间 NAS，客户端本地仅保留登录后的加密缓存；
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

### 2. 运行自动化密码学单元测试
```bash
npm test
```

### 3. 构建生产静态包
```bash
npm run build
```
编译产物将生成在 `dist/` 目录下，可直接放置于群晖 Web Station 或任意 Web 服务器的根目录。

### 4. NAS Docker 一键部署
进入工程目录，执行：
```bash
docker compose -f deploy/docker-compose.yml up -d --build
```
即可在局域网通过 `http://<NAS_IP>:8088` 访问。详细部署步骤请查阅 [极空间 NAS 私有化部署与远程同步指南](docs/极空间NAS私有化部署与远程同步指南.md)。

---

## 🔄 多电脑同步与发布更新规范

项目统一以 GitHub `main` 分支为唯一代码源。不同电脑之间不要互相复制整个项目文件夹，也不要复制 `node_modules`、`data` 或旧的 `dist` 目录。

### 在修改电脑上发布更新

1. 确认当前分支为 `main`，并先同步远程：
   ```bash
   git checkout main
   git pull --ff-only origin main
   ```
2. 修改代码后执行回归检查：
   ```bash
   npm install --prefer-offline --no-audit --no-fund
   npm test
   npm run build
   ```
3. 确认没有把密码数据库、日志或临时文件加入提交：
   ```bash
   git status
   git add <本次修改的文件>
   git commit -m "说明本次更新"
   git push origin main
   ```

也可以直接运行根目录的 **`同步最新代码.bat`** 完成“检查分支 → 拉取代码 → 恢复依赖 → 构建”的标准流程；需要更新后立即启动桌面端时，运行 **`更新并启动桌面客户端.bat`**。脚本发现未提交修改时会停止，不会覆盖本地工作。

### 在其他电脑获取更新

- 已有项目：双击 **`更新并启动桌面客户端.bat`**（同步后自动启动最新程序），或只更新不启动时双击 **`同步最新代码.bat`**；
- 新电脑：先 `git clone https://github.com/1510952971/safevault.git`，进入项目目录后运行该脚本；
- 确认版本：
  ```bash
  git log -1 --oneline
  ```
  看到最新提交后，再运行 **`启动桌面客户端.bat`**。桌面启动脚本会自动切换到脚本所在目录并重新构建资源，不使用旧缓存。

每台电脑建议只保留一个项目副本，并用该副本重新运行 **`生成桌面应用快捷方式.bat`**。如果更新前已有 SafeVault 在运行，使用 **`更新并启动桌面客户端.bat`** 会刷新旧实例；普通重复启动仍只激活已有窗口。

### 极空间 NAS 发布更新

1. 在已经拉取最新代码的电脑上运行 **`生成极空间部署包.bat`**；
2. 将 `deploy\zspace-package\dist`、`server` 和 `package.json` 一起覆盖到极空间原 SafeVault 目录；
3. 不删除、不覆盖极空间原目录中的 `data` 文件夹；
4. 在极空间 Docker 中重启原容器；
5. 访问 `http://NAS地址:8088/api/version`，确认 `serverVersion`、`frontendVersion` 都是当前版本且 `versionsMatch` 为 `true`。

桌面端可以下载新发行版后重启更新；NAS 容器无法安全地在运行中替换自身文件，因此不能采用完全相同的更新方式。NAS 必须按上述步骤整体替换程序文件并重启，但始终保留 `data` 目录。

`dist/assets` 与 `deploy/zspace-package` 属于构建产物，按规范不提交到 GitHub；每台电脑拉取代码后必须先构建，再生成 NAS 部署包。完整操作手册见 [docs/多电脑协作与发布更新规范.md](docs/多电脑协作与发布更新规范.md)。

### 极空间账号同步与可回滚保护

- 多台设备使用同一个极空间同步账号登录，NAS 是唯一数据源；设备本地只保留加密缓存。
- 登录后客户端始终拉取极空间上的最新密文金库；新增、修改、删除会先写回极空间，再更新本地缓存。
- 云端同步采用版本锁，旧设备不会直接覆盖新设备的数据；发生版本冲突时必须先重新拉取云端版本。
- 每次覆盖或回滚前自动写入 `data/backups/` 历史快照，默认保留最近 30 个版本，可在同步中心查看并回滚。
- 极空间远程访问生成的 `127.0.0.1:xxxxx` 是当前电脑的临时代理通道，不是账号所属地址。端口每次启动变化属于正常现象；PWA/远程访问页面会自动跟随当前网页，客户端也不会继续使用旧的本机代理端口。
- 如果登录提示当前代理指向了另一份数据库，请检查 Docker `safevault` 是否始终挂载同一个 `/app/data` 目录；不要因为端口变化重新注册账号，也不要删除并重建带有新数据目录的容器。
