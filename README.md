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
│   ├── NAS_DEPLOY.md                            # NAS 私有化部署图文手册
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
6. 🛡️ **本地持久化与安全密文灾备**：
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
即可在局域网通过 `http://<NAS_IP>:8088` 访问。详细部署步骤请查阅 [docs/NAS_DEPLOY.md](docs/NAS_DEPLOY.md)。
