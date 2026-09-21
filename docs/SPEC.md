# 个人私密密码保险箱小程序 (SafeVault) 需求规格说明书 (SPEC.md)

> **版本**：v1.0.0-Release  
> **状态**：已批准 (Approved) —— 研发执行不可动摇之最高宪法  
> **体系依据**：《基于大语言模型的软件与网站工程全流程精细化实操范式及 Skill 架构体系》

---

## 1. 系统边界与定位 (System Scope)

### 1.1 项目定位
SafeVault 是一款专为个人打造的**高安全性、零知识架构（Zero-Knowledge）、轻量响应式密码管理微应用**。系统专一负责个人账号、密码、密钥及私密凭据的安全录入、加密持久化、快捷检索、高强度密码生成与本地防灾备份。

### 1.2 In-Scope (P0 核心特性清单)
1. **主密码鉴权与金库初始化**：
   - 初次使用引导设置全局唯一主密码（Master Password）。
   - 每次进入必须验证主密码；支持“超时自动锁定”（1/3/5分钟无操作锁屏）。
2. **零知识强加密引擎 (Web Crypto API)**：
   - 采用标准 **PBKDF2-SHA256**（100,000 次哈希迭代）派生 256-bit AES 密钥。
   - 密码条目数据采用 **AES-GCM-256**（认证加密算法，每次加密使用独立 96-bit 随机 IV）强加密。
   - 所有明文仅在内存中即时计算，数据落盘与持久化存储 **100% 为密文字符串**，杜绝任何明文落盘。
3. **密码条目全生命周期管理 (CRUD)**：
   - 字段包括：标题/平台名、分类标签（网站/社交/工作/金融/游戏/其它）、账号/用户名、加密密码、官方网址、备注说明。
   - 支持新增、编辑、删除、快速模糊匹配检索。
4. **防窥与隐私交互**：
   - 列表中密码默认以 `••••••••` 脱敏展示；
   - 点击“眼睛”图标切换单条密码显隐；
   - 一键复制账号或密码，复制成功后启动 30 秒安全倒计时自动销毁剪贴板内容，防止恶意软件嗅探。
5. **专业强密码生成器**：
   - 支持 8 ~ 32 位长度滑块无级调节。
   - 支持自由勾选：大写字母 (A-Z)、小写字母 (a-z)、阿拉伯数字 (0-9)、特殊字符 (!@#$%^&*)，支持一键排除易混淆字符 (0/O, 1/l/I)。
   - 实时密码安全强度计算与视觉指示条（弱/中/强/极强）。
6. **纯本地离线持久化与密文灾备**：
   - 数据 100% 保存于本地浏览器沙箱存储（LocalStorage / IndexedDB），无任何外部云端网络请求。
   - 提供“一键导出加密备份文件（`.safevault.json`）”与“导入恢复数据”功能。备份文件本身也是通过主密码进行 AES-GCM 强加密包裹的密文。
7. **NAS 私有化部署与 PWA 跨端支持 (Home NAS Ready)**：
   - 支持通过 Docker / Docker Compose 一键部署到群晖、威联通、绿联、极空间等家用 NAS，或直接将静态单页托管于 NAS Web Station。
   - 具备 PWA（渐进式 Web 应用）能力：手机在家庭局域网或内网穿透访问 NAS IP:Port 时，可一键“添加到手机主屏幕”，获得宛如原生小程序/原生 App 的独立沉浸式体验。
   - 绝不因部署在 NAS 上而降低安全性：依旧遵循零知识架构，所有密码加解密 100% 在终端浏览器/手机内存执行，NAS 仅提供私有静态站点托管与灾备同步，杜绝明文上云。

### 1.3 Out-of-Scope (当前排除边界)
- 暂不开发依赖外部商业云服务器的多人团队账号共享（避免中心化服务器安全风险）。
- 暂不开发第三方浏览器全局自动填单爬虫扩展（保持轻量纯净安全）。

---

## 2. 核心数据实体 (Entities & Schemas)

### 2.1 金库配置与验证实体 (`VaultMeta`)
```typescript
interface VaultMeta {
  version: string;             // 规格版本号，例如 '1.0'
  salt: string;                // Base64 编码的 16 字节随机盐值 (用于 PBKDF2)
  testCipher: string;          // 验证主密码正确性的特征密文 (AES-GCM 加密已知常量 "SAFEVAULT_TOKEN")
  testIv: string;              // 验证密文的 12 字节随机 IV (Base64)
  lockTimeoutMinutes: number;  // 自动锁屏时长 (默认 3 分钟)
  createdAt: string;           // ISO 8601 时间戳
  updatedAt: string;           // 最后修改时间戳
}
```

### 2.2 密文存储条目实体 (`EncryptedVaultItem`)
```typescript
interface EncryptedVaultItem {
  id: string;                  // UUID
  title: string;               // 平台/应用名称 (明文索引)
  category: 'website' | 'work' | 'finance' | 'social' | 'game' | 'other';
  website?: string;            // 网站登录链接 (可选)
  encryptedPayload: string;    // Base64: 包含 { username, password, notes } 的 JSON 经 AES-GCM-256 加密后的密文
  iv: string;                  // Base64: 每次加密生成的 12 字节随机 IV
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
}
```

### 2.3 内存工作明文实体 (`DecryptedVaultItem`) —— 绝不写入存储介质
```typescript
interface DecryptedVaultItem {
  id: string;
  title: string;
  category: 'website' | 'work' | 'finance' | 'social' | 'game' | 'other';
  username: string;
  password: string;
  website?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2.4 离线加密备份实体 (`VaultBackupFile`)
```typescript
interface VaultBackupFile {
  app: 'SafeVault';
  exportVersion: '1.0';
  exportedAt: string;
  meta: VaultMeta;
  items: EncryptedVaultItem[];
}
```

---

## 3. 安全基线与加密流程 (Cryptographic Protocol)

```
[用户输入主密码] 
       ↓
[PBKDF2-SHA256 (迭代 100,000 次 + salt)] ──> 生成 256 位 Master Key (AES-GCM)
       ↓
[尝试解密 meta.testCipher]
       ├──> 失败 (Tag 不匹配): 提示“主密码错误”，严禁进入
       └──> 成功 ("SAFEVAULT_TOKEN"): 认证通过，持有临时内存会话
               ↓
[动态解密列表 items] ──> 在渲染视图中展示脱敏卡片
```

1. **零密钥残留**：关闭标签页、点击锁定按钮或超时计时器归零时，立即将内存中的派生 Key 和明文状态重置为 `null`，触发垃圾回收。
2. **防篡改与完整性校验**：AES-GCM 内置 128 位 Authentication Tag，任何离线篡改密文的行为均会导致解密直接抛出异常，杜绝注入风险。

---

## 4. 界面与验收基线 (Acceptance Criteria)

- **AC-1 (安全性铁律)**：无论使用浏览器 DevTools 查看 Storage，还是抓取控制台输出，都绝不可抓取到明文密码。
- **AC-2 (状态完整性覆盖)**：
  - **加载态 (Skeleton)**：解锁后解密数据时，必须展示闪烁骨架屏；
  - **空状态 (EmptyState)**：金库无记录或搜索无结果时，展示规范的视觉插画与“新增首个密码”引导按钮；
  - **错误态 (ErrorBoundary)**：输入错误主密码、损坏备份恢复等均有温和精准的 Toast 提示。
- **AC-3 (移动端无缝适配)**：在 360px ~ 430px（主流移动端）至 PC 4K 宽屏下均自适应流式排版，无横向滚动条，移动端底栏固定与防键盘遮挡。
- **AC-4 (响应性能)**：所有本地加解密与 500 条条目即时搜索筛选交互时延严格小于 30ms。
