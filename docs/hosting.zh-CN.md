# 托管、服务器端口与 DNS

[返回 README](../README.zh-CN.md) · [English](hosting.md) | 简体中文

## 先选择部署方式

| 方式 | 可用功能 | 需要管理的服务器端口 |
| --- | --- | --- |
| ChatGPT Sites | 完整 Worker 后端、可信登录、D1 存储、私有访问 | 不需要 |
| VPS 开发预览 | 页面和浏览器本地计划；没有真实云端登录、同步或 Outlook 服务端接口 | SSH；按需开放 HTTP/HTTPS |
| VPS 完整生产部署 | 需要先适配运行时、数据库和认证 | 适配后通常只公开 80/443 |

仓库目前支持前两种方式，并未提供开箱即用的生产 Node 服务。下面的 VPS 命令用于**临时开发预览**，不能替代完整云端部署。阅读或克隆文档不会自动修改任何服务器。

示例域名为 `planner.example.com`，服务器地址为 `YOUR_SERVER_IP`，SSH 用户为 `deploy`。请替换为自己的值，不要复制其他用户的 Sites DNS 目标和验证令牌。

## ChatGPT Sites：绑定自己的域名

1. 按 [README 的三步流程](../README.zh-CN.md#部署到-chatgpt-sites推荐)部署。
2. 先在该 Site 登记完整域名，例如 `planner.example.com`，获取准确的 DNS 目标和验证记录。
3. 在域名的 DNS 管理页面填写 Sites 返回的值：

   | 类型 | 名称 | 内容 |
   | --- | --- | --- |
   | CNAME | `planner`，或供应商要求的完整域名 | Sites 返回的准确目标主机名 |
   | TXT | Sites 返回的准确验证名称 | Sites 返回的准确验证令牌 |

4. TTL 可用默认值或 300 秒。DNS 服务商如果提供 HTTP 代理，先使用“仅 DNS”，除非 Sites 明确支持该代理配置。保存后在 Sites 刷新域名状态。
5. 等待域名验证和 TLS 证书均生效，再访问 `https://planner.example.com`。

CNAME 内容是主机名，不能带 `https://`、路径或端口。**同一个记录名已有 CNAME，就不要再添加 A / AAAA。** 目标主机名会继续解析到服务商地址，不需要猜测 Sites 的 IPv4/IPv6。TXT 必须放在 Sites 指定的名称；CNAME 同名也不能共存 TXT。如果收到的指引看似冲突，应检查 Sites 返回值，而不是自行猜测并移动 TXT。

根域名 `example.com` 要按供应商支持的 ALIAS/ANAME、CNAME flattening 或明确的地址记录配置。普通根域名 CNAME 可能与现有区域记录冲突；使用子域名通常更简单。

DNS 只负责指向主机，不负责把域名登记到托管平台，也不负责发布代码。解析正常但显示平台 404 时，还要检查域名是否绑定正确站点、发布是否成功、路由是否完成配置。

## VPS：通过 SSH 隧道私下预览

服务器安装 Node.js 24+、npm 和 Git 后运行：

```bash
git clone https://github.com/Raining-Sunshine/Personal-Research-Planner.git
cd Personal-Research-Planner
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

保持终端运行。Vite 中间件提供浏览器本地存储的预览，不是正式 Worker 后端。

在自己电脑的另一个终端运行：

```bash
ssh -N -L 5173:127.0.0.1:5173 deploy@YOUR_SERVER_IP
```

然后在该电脑访问 `http://localhost:5173`。如果本机 5173 被占用，把 SSH 命令里的**第一个** `5173` 改为 `5174`，再访问本机 5174。服务器只需要已有的 SSH 通道，不需要把 5173 开放到公网，也不需要配置 DNS。

## 可选：给临时 VPS 预览加域名

### 1. 添加 DNS 记录

使用你自己控制的 VPS 公网地址：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| A | `planner` | VPS 的公网 IPv4 |
| AAAA | `planner` | VPS 的公网 IPv6，仅在 IPv6 全链路正常时添加 |

AAAA 可以不填。错误的 AAAA 可能导致支持 IPv6 的客户端打不开，即使 IPv4 正常。改为 A/AAAA 前移除同名的旧 CNAME。改 DNS 不会迁移原来的计划数据库。

DNS 地址不包含端口。HTTP 默认 80，HTTPS 默认 443；直接使用 5173 必须把它写在 URL 里，建议用反向代理提供标准 HTTPS 地址。

### 2. 开放公网 Web 端口

在云服务商安全组和服务器系统防火墙两处，允许入站 **TCP 80、TCP 443**。保留来自管理 IP 的 SSH 访问。使用 IPv6 时也要设置对应规则。5173 只监听本机回环地址，不开放公网。

Ubuntu/Debian 使用 UFW 时先检查现有规则：

```bash
sudo ufw status verbose
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

`OpenSSH` 通常对应 22 端口。如果 SSH 改过端口，启用防火墙前先放行实际端口。上面只添加规则，不会启用处于关闭状态的防火墙。确认 SSH 和其他必要服务均已放行后，才按需执行 `sudo ufw enable`。不要重置现有规则；已有 nftables/firewalld 时直接配置它，不要叠加另一套管理器。

### 3. 允许预览域名

停止之前的 Vite 进程，然后用明确的主机名启动：

```bash
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=planner.example.com npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

不要设置 `allowedHosts: true`，也不要把开发进程绑定公网网卡。终端关闭后预览停止；不把它安装成永久生产服务。

### 4. 使用 Caddy 反向代理并启用 HTTPS

按 [Caddy 官方说明](https://caddyserver.com/docs/install)安装适合系统的版本。域名解析和入站端口正常时，Caddy 可自动申请、续期证书。

交互式生成密码哈希，不把明文密码写入命令或仓库：

```bash
caddy hash-password
```

在 `/etc/caddy/Caddyfile` 中添加下列配置，保留已有站点；替换域名和 `REPLACE_WITH_HASH`：

```caddyfile
planner.example.com {
    basic_auth {
        planner REPLACE_WITH_HASH
    }
    reverse_proxy 127.0.0.1:5173
}
```

这里使用 Caddy 2.8+ 语法。Basic Auth 只保护这个临时预览入口，**不会提供 Planner 用户系统或云端存储**。仅向可信人员开放。该域名、`localhost` 和不同浏览器的 localStorage 相互独立，需要搬运预览计划时导出再导入。

先检查配置，再重新加载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

以上假定安装包提供标准 systemd 服务且服务正在运行；若尚未运行，验证后执行 `sudo systemctl start caddy`。最终访问 `https://planner.example.com`，无需在公网开放 Vite 端口。

### 5. 排查连通性

```bash
# DNS 应与所选托管方式一致。
dig +short planner.example.com A
dig +short planner.example.com AAAA
dig +short planner.example.com CNAME

# 在 VPS 上检查监听进程与代理。
sudo ss -ltnp
curl -I http://127.0.0.1:5173
sudo systemctl status caddy
sudo journalctl -u caddy -n 50 --no-pager

# 在其他设备/网络检查公开 HTTPS 地址。
curl -I https://planner.example.com
```

启用密码保护后，未登录请求返回 **401 是正常现象**，在浏览器登录即可。连接超时检查路由和防火墙；502 检查 Vite 是否运行、代理端口是否一致；证书报错检查 DNS 和 TLS 配置。Debian/Ubuntu 的 `dig` 可通过 `dnsutils` 安装。分享日志前检查是否包含私人 URL 或标识符。

预览结束后停止 Vite 并移除对应 Caddy 配置。仅清理专为本预览添加且不再使用的防火墙/DNS 记录，保留其他服务。

## 完整生产自托管还缺什么

`dist/server/index.js` 导出 Worker 的 `fetch` 处理器，不会监听 TCP 端口。应用还依赖 D1 兼容的 `DB` 绑定和 Sites 可信身份入口。迁移到其他平台需要实现并验证：

1. Worker 请求/响应运行时适配器，或把后端移植到目标服务器框架。
2. 持久化数据库、迁移执行和等价的预处理语句、版本条件写入语义。
3. 真实认证和用户隔离。入口移除外部伪造身份头，只从验证后的会话生成身份，并实现前端使用的登录/退出路由。
4. 生产 HTTPS、正确的 Origin/CSRF 检查、安全的运行时密钥存储与备份。启用 OAuth 时，在 Microsoft 和环境变量中同时配置新的 HTTPS 回调地址。
5. 为**适配后的正式服务**配置进程管理和健康检查，让应用只监听本机地址，由反向代理提供公网访问。

Caddy 和 DNS 配置只解决网络层，不能补齐这些应用组件。生产后端适配完成并验证前，完整云端功能仍建议使用 Sites。
