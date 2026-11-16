# SafeVault 甲骨文云部署说明

当前生产云端使用 `https://safevault.985251.xyz`，极空间远程入口使用
`https://nas.985251.xyz`。本目录描述 SafeVault 在已有多软件 OCI 主机中的隔离方式。

## 目录隔离

不要把 SafeVault 放进个人网站或 PocketBase 的数据目录，也不要复用 PocketBase
数据库。推荐目录如下：

```text
/opt/mycloud/
├── Caddyfile                         # 公共入口，统一监听 80/443
├── docker-compose.yml                # 已有多软件编排
├── personal-site/                    # 个人网站及其数据
├── pocketbase_data/                  # PocketBase 独立数据
├── safevault-app/                    # SafeVault dist/server/package.json
├── safevault-data/                   # SafeVault 密文数据库
└── safevault-backup/                 # SafeVault 独立灾备快照
```

SafeVault 容器只加入现有 Compose 网络，不映射宿主机端口；公共 Caddy 使用
`safevault:8088` 转发到它。这样不会抢占现有 Caddy 的 80/443，也不会让不同软件
共享可写数据目录。

## 当前生产域名

- `safevault.985251.xyz`：Oracle 云端 SafeVault，同步服务器。
- `nas.985251.xyz`：Cloudflare Tunnel 到极空间，不指向 Oracle 实例。
- `985251.xyz` / `www.985251.xyz`：个人网站，保持原路由不变。
- `sync.985251.xyz`：已有 PocketBase 服务，保持原路由不变。

## 迁移顺序

1. 先备份 `/opt/mycloud/docker-compose.yml`、`Caddyfile` 和所有数据目录。
2. 上传 SafeVault 应用文件到 `safevault-app/`，创建空的 `safevault-data/` 和
   `safevault-backup/`，权限只授予 SafeVault 容器使用。
3. 在现有 Compose 中新增 SafeVault 服务，不能新增 80/443 端口映射。
4. 在公共 Caddy 中新增 `safevault.985251.xyz` 路由，其他站点块不改动。
5. 先通过服务器健康检查确认版本、数据目录和灾备目录，再切换 DNS/客户端。
6. 数据迁移必须使用旧环境的加密备份或经过核对的 `vault-store.json`；没有源数据
   时只部署空服务，禁止把本地测试数据当成生产数据上传。

## 资源边界

当前 OCI A1 实例按 2 OCPU/12 GB 运行。SafeVault 不新增实例、负载均衡器或公网
IP；容器设置内存上限，与个人网站、PocketBase 共享现有免费额度。后续增加软件时，
每个软件必须使用独立服务名、独立数据目录、独立备份目录和独立子域名。
