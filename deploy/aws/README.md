# SafeVault AWS 同步端（EC2 + EBS + Caddy）

该目录部署的是与极空间 NAS 完全相同的 SafeVault 服务端协议。AWS 端不保存主密码，
只保存账号认证摘要、加密金库密文和加密前的历史快照文件；客户端可把它设为主方案或备用方案。

## 推荐拓扑

`SafeVault 客户端 → HTTPS/Caddy → SafeVault 容器 → EC2 EBS 数据盘`

安全组只开放 TCP 80/443；8088 不对公网开放，SSH 仅允许管理员固定 IP。域名可以放在
Route 53，也可以继续使用 Cloudflare DNS；这里只要求域名最终解析到 EC2 公网地址。

## 首次部署

1. 创建 Ubuntu 22.04/24 的 EC2 实例，建议使用独立 EBS 数据卷。为域名创建 A/AAAA 记录指向实例。
2. 在实例安装 Docker Engine 和 Compose Plugin，把项目复制到实例，例如 `/opt/safevault`。
3. 在项目根目录执行：

   ```bash
   cp deploy/aws/.env.example deploy/aws/.env
   nano deploy/aws/.env
   mkdir -p deploy/aws/data deploy/aws/backup
   docker compose -f deploy/aws/docker-compose.yml up -d --build
   ```

4. 先访问 `https://你的域名/api/version`，确认返回 SafeVault 版本信息，再在软件的“同步方案选择”中
   选择“AWS 同步服务器”，填写这个 HTTPS 地址，使用同一个同步账号登录或注册。

首次把 AWS 作为第二端绑定时，软件只会在 AWS 为空时复制当前本地密文；发现 AWS 已有不同密文时会停止覆盖，
需要在软件中明确执行智能合并。

## 数据与备份

- `deploy/aws/data` 是账号、会话和当前密文金库，必须位于持久化 EBS；不要使用容器临时层。
- `deploy/aws/backup` 是历史快照，也必须持久化，并应使用 EBS Snapshot 或加密备份复制到 S3。
- 不要把 8088 暴露到公网，不要关闭 HTTPS，不要把 `.env` 上传到 GitHub。
- 生产环境应开启 EBS 加密、CloudTrail、CloudWatch 日志与定期恢复演练；AWS 账号本身建议启用 MFA。

## 双端工作方式

- 软件保存 NAS 和 AWS 各自的地址、令牌、版本、最后同步时间和密文指纹。
- 主方案写入成功后，会尝试把同一密文复制到另一端；另一端不可达时不影响本次主方案写入。
- 复制前会检查另一端为空，或仍等于上次已确认的密文指纹；如果另一端被独立修改，复制会停在冲突状态，不会覆盖。
- 读取/写入遇到网络错误或 5xx 时，客户端才会尝试另一端；认证失败、版本冲突、备份失败不会被当作网络故障吞掉。
- 切换方案前客户端先拉取并校验 AES-GCM 密文；解密失败或目标端为空而本地有数据时，切换会取消。

这套设计是“可用性备用 + 乐观并发锁 + 指纹防覆盖”，不是两个独立数据库之间的无条件覆盖复制。
如果两端都被不同设备同时修改，应先恢复网络，再在软件中执行智能合并或从历史版本回滚。
