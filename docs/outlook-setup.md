# Outlook 日历连接配置

Planner 中的「导入日历」支持三条路径：上传 `.ics`、粘贴 Outlook 发布的 ICS 链接、连接 Microsoft 账号。前两项不需要 Microsoft 应用注册。账号连接需要站点管理员先完成下面的配置；缺少配置时，网页会禁用连接并提供此说明。Microsoft 授权只用来读取日历，Planner 登录仍由 Sites 负责。

## 注册 Microsoft 应用

1. 登录 [Microsoft Entra 管理中心](https://entra.microsoft.com/)，进入 **Identity → Applications → App registrations → New registration**。如果个人 Microsoft 账号没有可用目录，可能需要先创建或加入 Entra 租户，或请组织管理员代为注册；这不影响 ICS 导入。
2. 名称可填 `Personal Research Planner`。若要同时使用工作/学校和个人 Outlook 账号，选择支持组织目录及个人 Microsoft 账号的账户类型。只供某个组织使用时可以选择单租户，并将该租户 ID 配置到下面的变量。
3. Redirect URI 选择 **Web**（不是 SPA），填写：

   ```text
   https://planner.diotimachang.com/api/outlook/callback
   ```

   必须与环境变量完全一致，不能使用旧的默认站点域名。自建部署时替换为自己的 HTTPS 域名。
4. 记录 **Application (client) ID**。打开 **Certificates & secrets → New client secret**，创建有有效期的客户端密钥，妥善保存它的 **Value**（不是 Secret ID）。到期前更换站点变量。
5. 在 **API permissions → Add a permission → Microsoft Graph → Delegated permissions** 加入 `Calendars.Read.Shared` 和 `offline_access`。这是用户委托的只读权限，不使用 Application permissions，也不请求日历写入。组织策略要求时，请管理员批准同意。
6. 保持隐式授权关闭。代码使用 Authorization Code + PKCE，并校验绑定当前 Planner 用户的一次性 state。

官方参考：[注册应用](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)、[读取共享日历](https://learn.microsoft.com/en-us/graph/outlook-get-shared-events-calendars)、[授权码流程](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)。

## 配置 Sites 服务端环境变量

通过 Sites 的运行时环境变量设置配置，**不要写到 GitHub、前端代码、聊天或 `.openai/hosting.json`**：

| 变量 | 值 |
| --- | --- |
| `MS_CLIENT_ID` | Application (client) ID |
| `MS_CLIENT_SECRET` | 客户端密钥的 Value |
| `MS_TENANT_ID` | `common`（默认），或组织的 Directory (tenant) ID；也支持 `organizations` / `consumers` |
| `MS_REDIRECT_URI` | `https://planner.diotimachang.com/api/outlook/callback` |
| `OUTLOOK_TOKEN_ENCRYPTION_KEY` | 随机 32 字节密钥的 Base64 字符串 |

在可信本地终端生成加密密钥：

```bash
openssl rand -base64 32
```

将输出直接存入站点机密设置，勿提交仓库。这个密钥用于 AES-256-GCM 加密服务端 D1 中的 Microsoft 令牌，并以 Sites 用户 ID 作为附加认证数据。更换它后，已有连接必须断开并重新授权；计划和已导入事件不受影响。客户端永远不会收到访问令牌、刷新令牌或 client secret。

## 在 Planner 使用

1. 用站点所有者身份打开自定义域名，点击 **导入日历 → Outlook → 连接 Outlook**。
2. 在 Microsoft 页面选择账号并同意只读日历访问，随后回到 Planner。再次打开导入窗口，选择日历。
3. 要使用别人分享的日历，先在 Outlook 接受邀请并把日历添加到自己的列表。列表来自 Microsoft Graph `/me/calendars`；这里只能显示 Graph 对当前账户公开的日历。组织策略、日历共享方式及个人账户限制可能导致某些共享日历不出现。此时请所有者提供已发布的 ICS 链接，或导出 `.ics`，从另一入口导入。
4. 选择「仅日历」或「指定项目」，设置读取范围，预览后确认。导入不会发邀请、修改会议或写回 Outlook。
5. 在已导入来源中点 **刷新 / 配置**，再点击 **预览导入**、**确认导入**。刷新会替换这个来源的快照，保留其他来源和手写事件。调整范围会移除该来源范围外的旧事件。没有后台定时同步。
6. 断开连接会删除 Planner 保存的令牌，保留已导入事件。若还要撤销 Microsoft 端同意，请到 Microsoft 账户/组织应用权限页撤销应用授权。

## ICS 与重复事件

- 上传 `.ics` 最大 2 MB。订阅链接支持 `https:` / `webcal:`，服务器只请求 `outlook.office365.com`、`outlook.office.com`、`outlook.live.com`；其他服务请上传文件。重定向也受同一白名单约束。
- 订阅链接可能自带访问凭据，保存在用户私有计划内；**JSON 备份也包含该链接**，不要公开备份。公开 GitHub 仓库只包含源码。
- 一次最多读取 366 天、2,000 次事件，计划总计最多 5,000 条。ICS 重复规则、EXDATE、RECURRENCE-ID、取消实例会展开成范围内的事件。复杂或过长的重复历史会明确报错，可改用较短日历导出。
- ICS 时区需要 UTC、浮动本地时间，或文件提供相应 VTIMEZONE；无法识别的 TZID 会报错，避免静默导入错误时间。全天事件保留日期；有时间事件按导入时设备的时区转换，并以这个墙钟时间保存。跨时区后要刷新来源才能重新转换，当前不提供每个事件独立时区设置。
- 导入事件只读，在来源修改后刷新。文件没有自动订阅能力，刷新需要重新选择文件。来源列表的时间是读取时间，顶部状态才是云端保存结果。
- 手动创建的 Event 可选每周（多选周几）或每月，间隔 1–12 周/月，截止日期可选。每月按起始日的几号重复，不存在的日期跳过（31 号不会挪到月末）。编辑、完成、删除针对整个系列；暂不支持单次例外修改。

## 验证范围

仓库自动化测试覆盖重复日期、ICS 例外、导入去重、来源隔离、账户权限、CSRF、URL 白名单、令牌加密和用户绑定。Microsoft 应用尚未配置时，无法进行真实账户授权和共享日历端到端验收；配置后请先使用测试日历验证。
