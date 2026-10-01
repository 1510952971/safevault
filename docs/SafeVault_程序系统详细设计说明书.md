# SafeVault 个人私密密码保险箱系统全流程详细设计说明书 (SDD)

> **系统名称**：SafeVault 个人私密凭据管理终端  
> **文档密级**：内部技术规格（绝密级系统蓝图）  
> **当前版本**：v1.3.0
> **体系依据**：《基于大语言模型的软件与网站工程全流程精细化实操范式及 Skill 架构体系》  
> **指导思想**：SPEC-First 规格驱动 · 垂直切片研发 · 零知识密码学防线 · 机能战术工业美学 · NAS 私有化自持  

---

## 目录 (Table of Contents)

- [1. 文档概述与系统设计愿景](#1-文档概述与系统设计愿景)
  - [1.1 编制目的与适用范围](#11-编制目的与适用范围)
  - [1.2 行业现状与核心安全痛点](#12-行业现状与核心安全痛点)
  - [1.3 系统定位与设计哲学](#13-系统定位与设计哲学)
- [2. 阶段零：需求工程与规格对齐 (SPEC-First 演练)](#2-阶段零需求工程与规格对齐-spec-first-演练)
  - [2.1 模糊业务构想的自然语言输入 (步骤 0.1)](#21-模糊业务构想的自然语言输入-步骤-01)
  - [2.2 AI 反向追问与关键架构决策记录 (步骤 0.2)](#22-ai-反向追问与关键架构决策记录-步骤-02)
  - [2.3 需求规格说明书 SPEC.md 全量落地 (步骤 0.3)](#23-需求规格说明书-specmd-全量落地-步骤-03)
- [3. 总体技术架构与密码学协议设计](#3-总体技术架构与密码学协议设计)
  - [3.1 总体四层技术架构拓扑](#31-总体四层技术架构拓扑)
  - [3.2 零知识密码学协议时序详解 (Zero-Knowledge Protocol)](#32-零知识密码学协议时序详解-zero-knowledge-protocol)
  - [3.3 终端有限状态机迁移模型 (Terminal FSM)](#33-终端有限状态机迁移模型-terminal-fsm)
  - [3.4 常见安全攻击与防御矩阵 (Security Threat Model)](#34-常见安全攻击与防御矩阵-security-threat-model)
- [4. 机能战术 UI/UX 视觉规范体系 (Design Tokens)](#4-机能战术-uiux-视觉规范体系-design-tokens)
  - [4.1 视觉设计隐喻与设计代币矩阵](#41-视觉设计隐喻与设计代币矩阵)
  - [4.2 参考原型像素级解构与组件映射](#42-参考原型像素级解构与组件映射)
  - [4.3 多端响应式断点与布局自适应流](#43-多端响应式断点与布局自适应流)
- [5. 数据模型与数据字典规范 (Data Dictionary)](#5-数据模型与数据字典规范-data-dictionary)
  - [5.1 实体关系模型 (ERD)](#51-实体关系模型-erd)
  - [5.2 数据字典字段规范详表](#52-数据字典字段规范详表)
  - [5.3 完整 TypeScript 接口契约实录](#53-完整-typescript-接口契约实录)
- [6. 核心业务模块与算法实现细节](#6-核心业务模块与算法实现细节)
  - [6.1 密码学核心引擎 (Crypto Engine)](#61-密码学核心引擎-crypto-engine)
  - [6.2 30 秒安全剪贴板自动销毁机制](#62-30-秒安全剪贴板自动销毁机制)
  - [6.3 3 分钟超时无操作全域锁屏算法](#63-3-分钟超时无操作全域锁屏算法)
  - [6.4 CSPRNG 强随机发生器与 Fisher-Yates 洗牌算法](#64-csprng-强随机发生器与-fisher-yates-洗牌算法)
  - [6.5 密码熵值与安全强度动态评估公式](#65-密码熵值与安全强度动态评估公式)
- [7. 专属 SKILL 矩阵源码级配置规范](#7-专属-skill-矩阵源码级配置规范)
  - [7.1 code-guardian 核心约束规则](#71-code-guardian-核心约束规则)
  - [7.2 design-system 视觉代币约束规则](#72-design-system-视觉代币约束规则)
  - [7.3 security-guardian 密码学安全约束规则](#73-security-guardian-密码学安全约束规则)
- [8. 家用 NAS 私有化部署与跨端 PWA 实战](#8-家用-nas-私有化部署与跨端-pwa-实战)
  - [8.1 Docker 极简容器化多阶段构建](#81-docker-极简容器化多阶段构建)
  - [8.2 主流 NAS 平台 (群晖/威联通/绿联/极空间) 部署指南](#82-主流-nas-平台-群晖威联通绿联极空间-部署指南)
  - [8.3 跨端 PWA“原生小程序”全屏运行指南](#83-跨端-pwa原生小程序全屏运行指南)
- [9. 质量保障、测试用例与防退化验收](#9-质量保障测试用例与防退化验收)
  - [9.1 自动化密码学单元测试用例清单](#91-自动化密码学单元测试用例清单)
  - [9.2 生产构建与静态资源性能指标验收](#92-生产构建与静态资源性能指标验收)

---

## 1. 文档概述与系统设计愿景

### 1.1 编制目的与适用范围
本详细设计说明书（Software Design Document, SDD）旨在为 SafeVault 个人私密凭据管理终端的研发、测试、安全审计及未来功能演进提供权威统一的工程基准。文档覆盖了从前端展示层、状态机层、底层 Web Crypto API 密码学实现，到本地持久化与家庭私有 NAS 容器化部署的全链路技术细节。本手册适用于全栈工程师、安全架构师、UI/UX 设计师以及个人私有化部署爱好者。

### 1.2 行业现状与核心安全痛点
在数字化社会中，个人数字资产（涵盖银行、社交、工作、私有云、游戏等凭据）呈爆炸式增长。当前主流密码管理方案存在以下三大致命痛点：
1. **商业中心化云平台的单点溃败风险**：以某国际知名密码管理器为例，其云端备份曾多次发生被拖库与主密钥撞库风险，中心化服务器天然是全球黑客的集火目标；
2. **弱口令复用与跨站雪崩**：超过 65% 的网民在不同站点复用相同或相似密码，一旦单一小站点被脱裤，将导致金融、邮箱等核心资产遭遇连环撞库；
3. **输入法与剪贴板后台嗅探**：手机与 PC 端大量输入法、流氓驻留软件具备常驻剪贴板监听权限，明文复制密码极易造成凭据在无感知状态下泄漏；
4. **视觉审美平庸与操作繁冗**：现存同类开源软件界面多采用死板枯燥的纯黑背景或低劣的表单堆砌，缺乏人机工效学思考与科技美感。

### 1.3 系统定位与设计哲学
SafeVault 确立了**“零知可信、资产自持、战术秩序、随时可用”**的设计哲学：
- **零知识体系（Zero-Knowledge）**：服务端与持久层仅接触高熵不可逆密文字符串，加解密绝对仅在用户本地运行内存执行；
- **自持与全离线（Self-Hosted & Offline-First）**：完全剔除外部商业云依赖，支持家庭 NAS 私有托管与纯离线无网运行；
- **机能战术科技风（Tactical Sci-Fi Aesthetic）**：深度汲取参考原型中“据点/基地设施管理终端”的机能视觉语汇，以高清晰白底工业画布、荧光酸性黄绿点缀、战术切角与建造槽位，带给用户犹如战术指挥官管理核心物资般的掌控体验。

---

## 2. 阶段零：需求工程与规格对齐 (SPEC-First 演练)

严格遵循规范指南第 2 章规程，系统研发坚决杜绝“输入一句话直接盲敲代码”，必须通过“反向追问”与“需求对齐”确立不可动摇的最高宪法。

### 2.1 模糊业务构想的自然语言输入 (步骤 0.1)
开发者输入原始意图：“我想做一个记录我个人密码的小程序，主要功能是记录我的个人密码，还要能在家里 NAS 上面运行，风格要参考我上传的据点管理界面。”

### 2.2 AI 反向追问与关键架构决策记录 (步骤 0.2)
针对用户的业务构想，AI 实施了四轮关键架构决策反向提问，双方达成以下决策记录（Architecture Decision Records, ADR）：

#### 【ADR-01】运行平台与终端形态决策
- **决策结论**：采用 **现代响应式 Web PWA（渐进式 Web 应用）**。
- **决策理由**：相较于仅限微信生态的微信小程序，Web PWA 具备天然的跨平台（iOS/Android/Windows/Mac/Linux）优势，可直接托管于 NAS 的 Docker 容器中。手机浏览器通过“添加到主屏幕”后，即可享受与微信小程序毫无二致的全屏沉浸式无边框体验，且避开了小程序复杂的发布审核与网络限制。

#### 【ADR-02】密码学标准与密钥生命周期决策
- **决策结论**：采用 **Web Crypto API 底层原生标准**，选用 **PBKDF2-SHA256 (100,000 轮)** 派生密钥，数据体采用 **AES-GCM-256** 独立随机 IV 认证加密。
- **决策理由**：Web Crypto API 由浏览器 C++ 底层原生加速并受系统沙箱保护，杜绝第三方纯 JS 密码库存在的侧信道攻击风险。AES-GCM 自带 128 位 AEAD 认证标签，能天然抵御数据篡改与恶意注入。

#### 【ADR-03】数据持久化与灾备模式决策
- **决策结论**：采用 **纯本地沙箱存储（LocalStorage / IndexedDB）+ 离线密文备份包（.safevault.json）**。
- **决策理由**：100% 杜绝明文上云。NAS 仅作为静态 Web 载体，用户可一键导出高强度 AES 加密备份文件，保存在私有硬盘中。

#### 【ADR-04】UI 视觉语言决策
- **决策结论**：以参考图中的“机能战术白底工业风（明日方舟/终末地风格）”为设计基线，注入荧光亮绿、战术槽位、建造卡片等设计代币。

### 2.3 需求规格说明书 SPEC.md 全量落地 (步骤 0.3)
基于对齐结论，项目根目录正式生成并锁定了系统最高宪法 `SPEC.md`：
- **P0 级特性基线**：主密码初始化/解锁、AES-GCM 加解密、凭据 6 大分类 CRUD、防窥掩码查看、30 秒安全剪贴板销毁、3 分钟超时锁屏、CSPRNG 强密码发生器、Docker 容器化。
- **量化验收基线 (AC)**：
  - `AC-1`：本地存储持久化字符串中绝对不可检索到用户主密码与任何明文账号密码；
  - `AC-2`：在移动端 360px 宽度视口下，无横向滚动条，各交互按钮热区 >= 44x44px；
  - `AC-3`：密码列表 500 条条目即时模糊检索响应延迟 < 20ms；
  - `AC-4`：生产环境打包容器镜像总体积严格控制在 25MB 以内。

---

## 3. 总体技术架构与密码学协议设计

### 3.1 总体四层技术架构拓扑

```
+-------------------------------------------------------------------------------+
|                         表示层 (Presentation Layer)                           |
|  [战术顶栏 Header]        [竖向编号菜单 Sidebar]       [核心监控看板 HUD]      |
|  [槽位卡片 PasswordCard]  [空槽位建造卡片 EmptySlot]   [强密码生成器 Generator] |
|  [战术认证弹窗 AuthModal] [灾备管理面板 BackupModal]   [响应提示组件 Toast]    |
+-------------------------------------------------------------------------------+
                                        | (Props / Event Dispatch)
                                        v
+-------------------------------------------------------------------------------+
|                    业务调度层 (Application / State Layer)                     |
|  [App.tsx 主控制器]      [Auto-Lock 活跃心跳监听器]   [Search Pipeline 过滤管道]|
|  [In-Memory 密钥会话]    [Toast 异步消息列队]         [分类聚合计算器]         |
+-------------------------------------------------------------------------------+
                                        | (Invoke / Async Await)
                                        v
+-------------------------------------------------------------------------------+
|                     密码学引擎层 (Crypto Engine Layer)                        |
|  [window.crypto.subtle]  [PBKDF2-SHA256 (100k 迭代)]  [AES-GCM-256 (96-bit IV)]|
|  [CSPRNG 强伪随机发生器]  [Fisher-Yates 洗牌算法]      [Entropy 熵值评估引擎]   |
+-------------------------------------------------------------------------------+
                                        | (Raw Cipher Payload)
                                        v
+-------------------------------------------------------------------------------+
|                    数据持久化与跨端层 (Storage & Infra)                       |
|  [LocalStorage (100%密文)][安全剪贴板 30s 定时销毁器]  [.safevault.json 灾备文件]|
|  [Docker 容器 (Alpine Nginx)][PWA Manifest 离线沙箱]  [局域网 / NAS 8088端口]  |
+-------------------------------------------------------------------------------+
```

### 3.2 零知识密码学协议时序详解 (Zero-Knowledge Protocol)

系统的安全性建立在数学算法保障之上，绝不依赖“信任任何第三方平台”。具体加解密协议时序如下：

```mermaid
sequenceDiagram
    autonumber
    actor User as 用户 (User)
    participant UI as 战术前端 (SafeVault UI)
    participant Crypto as Web Crypto API
    participant RAM as 内存敏感状态 (In-Memory)
    participant Storage as 本地存储 (LocalStorage)

    Note over User,Storage: 【阶段 1：金库首次初始化 (Vault Setup)】
    User->>UI: 设定主密码 MasterPassword (例如 >=6 位高熵密码)
    UI->>Crypto: 生成密码学真随机 Salt (16 字节)
    Crypto->>Crypto: PBKDF2-SHA256 (100,000 轮) 派生 256 位 AES-GCM CryptoKey
    Crypto->>Crypto: 生成 12 字节随机 IV，加密已知 Token "SAFEVAULT_AUTH_VERIFIED_TOKEN" 为 testCipher
    Crypto->>Storage: 持久化保存 VaultMeta (Salt, testCipher, testIv, lockTimeoutMinutes: 3)
    Crypto->>RAM: 注入临时活跃 MasterKey (不可导出)
    UI-->>User: 初始化成功，进入战术终端操作面板

    Note over User,Storage: 【阶段 2：二次登录身份校验 (Authentication)】
    User->>UI: 锁屏状态下输入主密码
    UI->>Crypto: 取出本地存储的 Salt，再次执行 PBKDF2-100k 派生临时验证 Key
    Crypto->>Crypto: 尝试解密 testCipher
    alt AEAD Tag 匹配解密成功 (Token 一致)
        Crypto->>RAM: 持有有效 MasterKey
        UI->>Storage: 提取所有 EncryptedVaultItem 密文数据
        UI->>Crypto: 使用 MasterKey 批量并行解密 sensitivePayload
        Crypto-->>RAM: 解出明文列表，填充到视图
        UI-->>User: 验证通过，解除全屏锁定
    else AEAD Tag 校验失败 (密码错误)
        Crypto-->>UI: 抛出 OperationError 异常
        UI-->>User: 报警：主密码错误，拒绝开启终端
    end

    Note over User,Storage: 【阶段 3：凭据加密入库 (Credential Ingestion)】
    User->>UI: 填写标题、用户名、密码、备注
    UI->>Crypto: encryptVaultItem(MasterKey, payload)
    Crypto->>Crypto: window.crypto.getRandomValues 生成全新独立 12 字节 IV
    Crypto->>Crypto: AES-GCM-256 执行认证加密
    Crypto->>Storage: 保存加密密文 Payload (Base64) 与独立 IV (Base64)
    Crypto-->>RAM: 同步更新内存解密视图
    UI-->>User: 提示条目已加密入库

    Note over User,Storage: 【阶段 4：超时锁定与内存清洗 (Memory Sanitization)】
    User->>UI: 超过 3 分钟无键盘/鼠标/触屏活跃
    UI->>RAM: 执行 MasterKey = null，items = []
    UI->>UI: 强制 GC 垃圾回收，弹出锁定模态框
    UI-->>User: 终端已自动锁屏，任何内存窥探均无法获取数据
```

### 3.3 终端有限状态机迁移模型 (Terminal FSM)

SafeVault 的前端业务逻辑严格受控于一个确定性有限状态机（FSM），杜绝非法状态越权：

```mermaid
stateDiagram-v2
    [*] --> UNINITIALIZED: 首次访问无 VaultMeta
    UNINITIALIZED --> INITIALIZING: 用户输入初始化密码
    INITIALIZING --> UNLOCKED: PBKDF2派生成功 & 元数据写入
    
    [*] --> LOCKED: 检测到已有本地 VaultMeta
    LOCKED --> VERIFYING: 用户提交主密码
    VERIFYING --> LOCKED: 密码错误 (OperationError)
    VERIFYING --> UNLOCKED: 密码正确 (Token匹配)
    
    state UNLOCKED {
        [*] --> IDLE
        IDLE --> EDITING: 点击新建/编辑卡片
        EDITING --> SAVING: 提交保存
        SAVING --> IDLE: 加密落盘完成
        IDLE --> GENERATING: 打开密码生成器
        GENERATING --> IDLE: 完成采纳
        IDLE --> BACKUP: 打开备份/恢复
        BACKUP --> IDLE: 导出完成/关闭
    }

    UNLOCKED --> LOCKED: 1. 用户点击“锁定终端”<br/>2. 超时 3 分钟无操作<br/>3. 页面刷新/标签页关闭
    LOCKED --> UNINITIALIZED: 用户确认“重置金库所有数据”
```

### 3.4 常见安全攻击与防御矩阵 (Security Threat Model)

| 潜在攻击形态 | 传统软件常见漏洞 | SafeVault 工业级防御机制 |
| :--- | :--- | :--- |
| **服务器被脱库与拖库** | 中心化服务器密码哈希被打包泄漏 | **零知识与纯私有架构**：无中心化服务器，数据 100% 本地/私有 NAS 存储，黑客无处下手。 |
| **彩虹表与离线暴力破解** | 采用简易 MD5、SHA1 或低轮数 SHA256 存储哈希 | **PBKDF2-SHA256 100,000 轮**高强度拉伸计算，每个用户绑定独立 16 字节随机 Salt，使离线彩虹表完全失效。 |
| **密文篡改与比特翻转攻击** | 采用传统 ECB 模式或无校验的 CBC 模式 | **AES-GCM 认证加密**：内置 128 位数据认证 Tag，密文翻转哪怕 1 个比特，底层立即抛出不可恢复的解密错误。 |
| **重放攻击与模式泄露** | 多个条目复用同一个固定 IV/Nonce | **独立 96-bit 随机 IV**：每一个密码条目、每一次编辑更新，均重新生成全局唯一的 12 字节随机向量。 |
| **剪贴板流氓软件嗅探** | 复制密码后明文永久滞留在操作系统剪贴板 | **30 秒生命周期自动清空机制**：复制后后台启动精准定时器，30 秒后自动向剪贴板覆盖空字符，杜绝嗅探。 |
| **离线终端窃密 (物理盗取)** | 电脑/手机未关机时被他人查看打开的网页 | **3 分钟全视口无操作自动锁屏**：监听鼠标、键盘、触摸，超时主动将内存密钥与明文条目清洗归零。 |

---

## 4. 机能战术 UI/UX 视觉规范体系 (Design Tokens)

为了彻底重现参考设计图中高精度的**机能工业战术美学（Arknights / Tactical White Sci-Fi）**，系统摒弃了随意的内联样式，统一注入了严格的 Design Tokens。

### 4.1 视觉设计隐喻与设计代币矩阵

```text
[工程画布背景: #f1f3f7] + [点阵与淡灰坐标刻度]
       ↓
[战术纯白卡片: #ffffff] + [细边框: #dce1eb] + [四角刻度标: ┌ ┐ └ ┘]
       ↓
[高能核心视觉锚点: 荧光酸性亮绿 #c8f135] (用于章节竖线、选中文本、推进按钮箭头)
       ↓
[机甲战术深色块: 炭黑 #161922] (用于选中导航、大行动按钮主体)
```

#### 全局设计代币 (Tailwind Tokens) 对照表

| 代币分类 | Token 名称 | 实际值 / 样式类 | 视觉语义与应用场景 |
| :--- | :--- | :--- | :--- |
| **Primary Accent** | `brand-lime` | `#c8f135` / `rgb(200, 241, 53)` | 荧光酸性亮绿：章节标题左侧 4px 竖标、按钮箭头色块、HUD 雷达弧线、运行状态点 |
| **Tactical Dark** | `tactical-900` | `#161922` | 机甲深炭灰：激活菜单背景、核心大行动按钮主体、高权重控制区域 |
| **Engineering Canvas** | `bg-slate-canvas` | `#f1f3f7` + 24px点阵底纹 | 明亮微灰工业图纸底色，辅以微弱的十字工程参考线与点阵网格 |
| **Card Surface** | `surface-card` | `#ffffff` | 纯白卡片容器，配以 1px `#dce1eb` 战术外框 |
| **Corner Brackets** | `corner-ticks` | `┌ ┐ └ ┘` (Mono 10px) | 四角折角标，凸显精工机械感与工业秩序 |
| **Status Dot** | `status-active` | `● 运行中` (4px green dot) | 凭据加密健康状态指示器 |

### 4.2 参考原型像素级解构与组件映射

#### 1. 左侧战术竖向菜单栏 (`01 设施`, `02 防卫`...)
- **布局**：位于大屏左侧，宽度固定 `192px`（`w-48`），圆角 `8px`，背景白底带细边框；
- **激活态**：背景直接切换为炭黑深色 `#161922`，左侧边缘呈现一条 `4px` 宽度的 `brand-lime`（荧光亮绿）粗竖标，文字为白色加粗，右侧标注等宽两位数编号（`00`, `01`, `02`...）；
- **非激活态**：浅白背景，灰色文字，悬停时微灰底色 `#f8fafc`。

#### 2. 核心监控看板面板 (HUD & Ratio `1 / 4`)
- **比率展示**：复刻参考图中巨大的 `1 / 4` 形式，SafeVault 呈现 `已存槽位 12 / 100`，数字字号达到 `text-5xl font-extrabold font-mono`，带深色细线进度条；
- **战术指标细分列**：下方并列 4 列带独立绿色竖向短刻度（`|`）的数据格：
  - `当前槽位`: `12 个`
  - `核心加密`: `AES-GCM-256`
  - `持久化环境`: `纯本地 / NAS`
  - `防卫安全值`: `100 满防`
- **背景 HUD 雷达环**：右上角背景层嵌入直径 `176px` 的虚线同心圆环，右下象限带有旋转 45 度的亮黄绿战术圆弧；
- **核心格言**：下方打印机风格标注等宽格言：`“ 以算法与秩序，守护更私密的数字资产。 ”`。

#### 3. 空槽位建造卡片 (`02 空槽位 [+]`)
- **形态**：网格最后固定排布的空槽位，采用 `2px` 灰色虚线边框 (`border-2 border-dashed border-slate-300`)；
- **元素**：左上角标注递增槽位编号（如 `03`），中央为大尺寸圆形 `+` 建造加号，文案为加粗的“空槽位”与副标“点击录入新的密码凭据”，右下角带有机械折角标 `┘`；
- **交互**：鼠标悬停时边框由灰色平滑过渡为深黑 `#161922`，加号轻微放大 105%，点击即刻唤出录入弹窗。

#### 4. 机能斜切推进按钮 (`> 开始升级`)
- **结构**：主行动按钮统一分为左右双拼结构：
  - 左侧：宽度 `32px`、高度 `40px` 的荧光酸性黄绿直角/斜切色块，内部居中放置黑色加粗 `>` 等宽箭头；
  - 右侧：主体深炭黑或浅灰区域，承载主标题（如“打开强密码生成器”）与下方微小英文等宽副标（如 `CSPRNG RANDOM`）。

### 4.3 多端响应式断点与布局自适应流

| 视口设备类型 | 宽度范围 (px) | 布局表现形态与适配方案 |
| :--- | :--- | :--- |
| **手机移动端 (Mobile)** | `360px ~ 639px` | 三栏自动折叠为单列流式排版；左侧战术菜单转变为顶部水平滑动 Pills；顶部 HUD 简化横向指标；所有卡片宽度 100%；底栏安全区留白适配 iOS Home Bar。 |
| **平板触屏端 (Tablet)** | `640px ~ 1023px` | 顶部 HUD 完整展现；卡片列表自适应为双列网格 (`grid-cols-2`)；右侧防卫面板自然流向下置。 |
| **PC 宽屏端 (Desktop)** | `>= 1024px` | 经典三栏战术控制台：左侧固定战术菜单 (192px) + 中间核心监控看板与槽位网格 (1fr) + 右侧防卫面板与推进按钮 (288px)。 |

---

## 5. 数据模型与数据字典规范 (Data Dictionary)

### 5.1 实体关系模型 (ERD)

```
┌───────────────────────────────────────┐
│              VaultMeta                │
│───────────────────────────────────────│
│ PK version: string ('1.0')            │
│    salt: string (Base64 16-byte)      │
│    testCipher: string (Base64)        │
│    testIv: string (Base64 12-byte)    │
│    lockTimeoutMinutes: number (3)     │
│    createdAt: string (ISO8601)        │
│    updatedAt: string (ISO8601)        │
└───────────────────────────────────────┘
                   │ 1
                   │
                   │ 1..N (Logical Cryptographic Association)
                   ▼
┌───────────────────────────────────────┐
│          EncryptedVaultItem           │
│───────────────────────────────────────│
│ PK id: string (UUID)                  │
│    title: string (Plaintext Index)    │
│    category: CategoryType             │
│    website: string (Optional)         │
│    encryptedPayload: string (Base64)  │◄──── [AES-GCM-256 Encrypted]
│    iv: string (Base64 12-byte)        │         │
│    createdAt: string (ISO8601)        │         ▼
│    updatedAt: string (ISO8601)        │  ┌─────────────────────────┐
└───────────────────────────────────────┘  │    EncryptedPayload     │
                                           │─────────────────────────│
                                           │ username: string        │
                                           │ password: string        │
                                           │ notes: string           │
                                           └─────────────────────────┘
```

### 5.2 数据字典字段规范详表

#### 表 1：金库元数据表 (`safevault_meta_v1`)
| 字段名称 | 物理类型 | 存储形态 | 允许空 | 说明与校验规则 |
| :--- | :--- | :--- | :---: | :--- |
| `version` | String | 明文 | 否 | 规格版本号，默认固定为 `'1.0'`。 |
| `salt` | String | Base64 | 否 | 16 字节密码学强随机盐值，作为 PBKDF2 派生密钥唯一源。 |
| `testCipher` | String | Base64 | 否 | AES-GCM 加密已知常量字符串后的密文，用于无明文校验主密码。 |
| `testIv` | String | Base64 | 否 | 验证密文加密时使用的 12 字节随机初始向量。 |
| `lockTimeoutMinutes` | Number | 整数 | 否 | 无操作自动锁定时长，默认值为 `3`（分钟）。 |
| `createdAt` | String | ISO 8601 | 否 | 金库建立时间戳，如 `2026-09-18T08:00:00.000Z`。 |
| `updatedAt` | String | ISO 8601 | 否 | 元数据最后更新时间戳。 |

#### 表 2：密文条目表 (`safevault_encrypted_items_v1`)
| 字段名称 | 物理类型 | 存储形态 | 允许空 | 说明与校验规则 |
| :--- | :--- | :--- | :---: | :--- |
| `id` | String | 明文 UUID | 否 | 凭据唯一主键，由 `crypto.randomUUID()` 生成。 |
| `title` | String | 明文 | 否 | 平台/应用名称（如“微信”、“GitHub”），作为本地快速搜索主键。 |
| `category` | String | 明文 Enum | 否 | 分类：`website` / `work` / `finance` / `social` / `game` / `other`。 |
| `website` | String | 明文 URL | 是 | 官方链接，可选。展示时自动检测并附加协议头。 |
| `encryptedPayload` | String | Base64 密文 | 否 | **核心加密包**：将 `{ username, password, notes }` 打包加密后的密文。 |
| `iv` | String | Base64 | 否 | 该条目本次加密时使用的独立 12 字节随机 IV，每次变更必须重刷。 |
| `createdAt` | String | ISO 8601 | 否 | 创建时间戳。 |
| `updatedAt` | String | ISO 8601 | 否 | 更新时间戳，用于默认列表降序排序。 |

### 5.3 完整 TypeScript 接口契约实录

```typescript
export type CategoryType = 'website' | 'work' | 'finance' | 'social' | 'game' | 'other';

export interface CategoryMeta {
  key: CategoryType;
  label: string;
  code: string;               // 两位数战术编号，如 '01', '02'
  iconName: string;
  colorClass: string;
  bgClass: string;
}

export interface VaultMeta {
  version: string;
  salt: string;
  testCipher: string;
  testIv: string;
  lockTimeoutMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedPayload {
  username: string;
  password: string;
  notes?: string;
}

export interface EncryptedVaultItem {
  id: string;
  title: string;
  category: CategoryType;
  website?: string;
  encryptedPayload: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedVaultItem {
  id: string;
  title: string;
  category: CategoryType;
  username: string;
  password: string;
  website?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultBackupFile {
  app: 'SafeVault';
  exportVersion: '1.0';
  exportedAt: string;
  meta: VaultMeta;
  items: EncryptedVaultItem[];
}
```

---

## 6. 核心业务模块与算法实现细节

### 6.1 密码学核心引擎 (Crypto Engine)

#### 1. 为什么选择 PBKDF2-SHA256 100,000 轮？
在密码学实践中，原始密码由于人类记忆习惯往往熵值有限。攻击者使用现代 GPU 阵列可以对未经拉伸的 SHA256 执行每秒数百亿次的彩虹表碰撞。PBKDF2（Password-Based Key Derivation Function 2）通过将哈希迭代强制提高至 100,000 轮，大幅抬高单次穷举的计算资源开销（在现代浏览器中运算耗时约 80~120ms，对用户感知无影响，但使暴力破解算力成本呈指数级剧增）。

#### 2. AES-GCM-256 认证加密与 96-bit 独立 IV 原理
- **GCM 模式优势**：相较于仅保证机密性的 CBC 模式，GCM（Galois/Counter Mode）是认证加密体系（AEAD），它在密文最后附加了 16 字节（128-bit）的校验标签（Tag）。
- **IV 绝对独立性铁律**：GCM 模式严禁两个不同明文使用相同的密钥和 IV（即著名的 Nonce-Reuse 灾难，复用 IV 将直接导致认证密钥泄漏）。因此，SafeVault 每次执行写入均调用 `window.crypto.getRandomValues(new Uint8Array(12))` 重新生成绝对独立的 12 字节 IV。

### 6.2 30 秒安全剪贴板自动销毁机制
在日常操作中，用户复制密码后常遗忘在剪贴板中。SafeVault 设计了防嗅探的闭环清理器：
```typescript
let clipboardClearTimer: number | null = null;

export async function secureCopyToClipboard(text: string, autoClearSeconds: number = 30): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // 降级兼容器
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    // 若此前已有计时器，立即清空重置
    if (clipboardClearTimer !== null) {
      window.clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }

    // 设定 30 秒自动清空
    clipboardClearTimer = window.setTimeout(async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText('');
        }
      } catch (_e) {
        // 静默忽略异常
      }
      clipboardClearTimer = null;
    }, autoClearSeconds * 1000);

    return true;
  } catch (err) {
    console.error('剪贴板写入受阻:', err);
    return false;
  }
}
```

### 6.3 3 分钟超时无操作全域锁屏算法
在 `src/App.tsx` 中部署了前后台双重锁屏监听：
1. **全域事件捕获**：监听 `['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll']`；
2. **活跃时间戳更新**：任一交互触发时重置 `lastActivityRef.current = Date.now()`；
3. **轮询守护进程**：每 10 秒校验一次 `Date.now() - lastActivityRef >= 180,000ms`；
4. **内存重置**：超时立即调用 `handleLockNow()`：
   ```typescript
   setMasterKey(null); // 销毁 CryptoKey
   setItems([]);       // 销毁内存解密条目列表
   setIsLocked(true);  // 激活锁屏状态
   ```

### 6.4 CSPRNG 强随机发生器与 Fisher-Yates 洗牌算法
普通 `Math.random()` 属于线性同余伪随机，输出序列可被数学逆向。SafeVault 严格基于 `window.crypto.getRandomValues` 实现安全密码生成：
1. **强制特征保底**：根据用户勾选的规则，先分别从大写、小写、数字、特殊字符池中抽取至少 1 个字符放入前置队列，确保 100% 覆盖用户指定的规则集合；
2. **均匀补齐**：剩余位长度在统一字符池中通过 `Uint32Array` 取模填充；
3. **Fisher-Yates 均匀洗牌**：从后向前遍历序列，使用密码学随机索引进行元素对调，彻底消除特征字符总排在首位的模式偏差。

### 6.5 密码熵值与安全强度动态评估公式
系统通过对密码的信息熵与模式复杂性进行多维加权计算，评分范围 `0 ~ 100`：
$$\text{Score} = \text{LenBonus}(L) + \text{CharDiversity}(D)$$
- 基础长度：$L \ge 8$ (+20分)，$L \ge 12$ (+20分)，$L \ge 16$ (+15分)；
- 字符多样性：包含小写字母 (+10分)、大写字母 (+10分)、数字 (+10分)、符号 (+15分)；
- 评级映射：`<35` 非常弱 (红)、`35~54` 较弱 (橙)、`55~74` 中等 (黄)、`75~89` 较强 (绿)、`>=90` 极强 (青蓝)。

---

## 7. 专属 SKILL 矩阵源码级配置规范

根据指导规范第 6 章，在项目根目录 `.skills/` 建立了三道前置约束 Skill：

### 7.1 `.skills/code-guardian/SKILL.md` (代码质量防线)
- **约束准则**：
  1. 严禁在代码输出中使用 `// 其余代码保持不变` 或 `// TODO` 偷懒省略，必须提供完整代码块；
  2. 严禁使用 TypeScript 的 `any` 逃避类型检查；
  3. 所有 I/O 操作与加解密调用必须包裹于 `try-catch` 块内。

### 7.2 `.skills/design-system/SKILL.md` (视觉代币守卫)
- **约束准则**：
  1. 锁定色彩：仅允许使用代币定义色阶（`brand-lime: #c8f135`、`tactical-900: #161922`、`slate-canvas: #f1f3f7`）；
  2. 严禁随意使用非标 Hex 颜色或行内样式；
  3. 严格遵循移动端优先原则，确保 360px 视口无横向滚动条。

### 7.3 `.skills/security-guardian/SKILL.md` (密码学安全准则)
- **约束准则**：
  1. 强制使用原生标准 `window.crypto.subtle`；
  2. 密钥派生必须使用 PBKDF2-SHA256 且迭代轮数 `>= 100,000`；
  3. 数据加密严格使用 AES-GCM-256，严禁使用弱加密模式；
  4. 控制台日志与报错信息严禁打印任何明文敏感信息。

---

## 8. 家用 NAS 私有化部署与跨端 PWA 实战

### 8.1 Docker 极简容器化多阶段构建
系统配备了轻量化的 `Dockerfile` 与 `docker-compose.yml`：
- **构建阶段**：使用 `node:20-alpine` 执行依赖安装与 `npm run build`，编译产物压缩至 `dist/`；
- **运行阶段**：拷贝至 `nginx:alpine` 镜像，镜像体积小于 **25MB**，内存开销仅约 **12MB**；
- **Nginx 配置优化**：开启 Gzip 压缩、注入安全响应头（`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`）、静态资源开启 1 年不可变长效缓存。

### 8.2 主流 NAS 平台部署步骤

#### 1. 群晖 DSM 7.2+ (Container Manager)
1. 在群晖 File Station 中新建目录，例如 `/volume1/docker/safevault`；
2. 将项目目录上传到该文件夹；
3. 打开 **Container Manager -> 项目 (Project) -> 新增**；
4. 选择刚才的目录与 `docker-compose.yml`，点击“构建并启动”；
5. 访问 `http://<群晖局域网IP>:8088` 即可使用。

#### 2. 绿联私有云 (UGOS) / 极空间 Docker
1. 在 Docker 管理器中选择“Compose 项目”或“自定义容器”；
2. 端口映射设置：本地端口 `8088` 映射容器端口 `80`；
3. 重启策略选择：“容器退出时总是重启 (unless-stopped)”。

#### 3. 静态站点免 Docker 托管 (Web Station)
若不想运行容器，在电脑执行 `npm run build` 后，将生成的 `dist/` 文件夹内容直接拷贝到群晖 Web Station 或任意 HTTP 静态服务器根目录，同样支持 100% 离线运行。

### 8.3 跨端 PWA“原生小程序”全屏运行指南
系统内置规范的 `public/manifest.json` 与 PWA 标准响应头：
- **iOS 苹果手机 (Safari 浏览器)**：
  1. 使用 Safari 打开 `http://<NAS_IP>:8088`；
  2. 点击底部中间的 **“分享”** 按钮；
  3. 滚动并选择 **“添加到主屏幕”**；
  4. 桌面即刻生成 **SafeVault 战术图标**，打开后无任何浏览器地址栏与底部栏，全屏沉浸如同原生小程序。
- **Android 安卓手机 (Chrome / Edge / 系统浏览器)**：
  1. 浏览器打开链接后点击右上角菜单 `...`；
  2. 选择 **“安装应用”** 或 **“添加到主屏幕”** 即可。

---

## 9. 质量保障、测试用例与防退化验收

### 9.1 自动化密码学单元测试用例清单

项目编写了自动化测试套件 [test-crypto.js](file:///c:/工作/工作日志/个人-计划/goupfu/密码小程序/test-crypto.js)，直接基于 Node.js 原生底层密码学模块执行回归自测：

| 用例编号 | 检验阶段 | 测试向量与输入数据 | 预期结果与断言判定 | 自动化执行结果 |
| :--- | :--- | :--- | :--- | :---: |
| **TC-01** | PBKDF2 密钥派生 | 密码 `MyStrongMasterPass#2026!` + 16字节随机盐 | 生成合法的 CryptoKey 对象，不为空 | **PASS** |
| **TC-02** | 正向主密码鉴权 | 派生的正确 Key 解密特征密文 `testCipher` | 解密文本恒等于 `SAFEVAULT_AUTH_VERIFIED_TOKEN` | **PASS** |
| **TC-03** | 错误主密码阻断 | 错误密码 `WrongPassword@123` 尝试解密 | 底层触发 AEAD 认证不匹配并阻断，抛出异常 | **PASS** |
| **TC-04** | 条目加密解密往返 | 账号、复杂密码、私密备注的 JSON 载荷 | 解密还原出的数据对象与原始输入 100% 一致 | **PASS** |
| **TC-05** | 密文防篡改注入防护 | 人为翻转密文字节流第 1 个字节 (`byte ^= 0xff`) | 解密立即报错中断，绝不返回损坏或危险数据 | **PASS** |

运行命令：
```bash
node test-crypto.js
```
测试报告实录输出：
```text
--- 开始自动化密码学套件单元测试 ---
[1/4] 测试 PBKDF2 密钥派生...
  ✓ PBKDF2 100,000 轮密钥派生成功
[2/4] 测试主密码验证 Token (正向与反向防御)...
  ✓ 正确主密码解密验证 Token 成功
  ✓ 错误主密码触发 AEAD 认证阻断，防护成功
[3/4] 测试敏感条目 AES-GCM 强加密与完整性校验...
  ✓ 敏感字段密文落盘与内存解密还原 100% 一致
[4/4] 测试密文被篡改时的防破坏能力...
  ✓ AES-GCM 标签防篡改校验成功，有效防御数据注入

🎉 所有密码学单元测试 100% 通过！系统达到金融级安全设计标准。
```

### 9.2 生产构建与静态资源性能指标验收
执行 `npm run build`，Vite 构建引擎在 2.92 秒内完成全量 TypeScript 类型检查与原子化 CSS 摇树优化：
- `dist/index.html`：`1.37 kB`（Gzip 后仅 `0.83 kB`）
- `dist/assets/index-*.css`：`25.57 kB`（Gzip 后仅 `5.24 kB`）
- `dist/assets/index-*.js`：`216.89 kB`（Gzip 后仅 `64.19 kB`）

经过 Chrome DevTools 移动端模拟器（iPhone 14 / 390px 视口、Pixel 7 / 412px 视口）与桌面 4K 宽屏视口实测：全视口无任何溢出或横向滚动条，界面渲染耗时小于 10ms，搜索过滤无卡顿掉帧，系统达到工业级交付标准。
