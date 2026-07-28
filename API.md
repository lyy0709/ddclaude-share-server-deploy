# ddclaude-share-server 部署与外部系统 API

本文只记录部署、运维和外部系统对接需要使用的稳定接口。以下内容不属于本文范围：

- Web 管理后台 `/admin/*`；
- Claude Web 用户侧代理 `/api/*`；
- Project、对话记录等本地数据表及其内部同步逻辑。

账号凭据必须通过管理 API 或 Web 管理后台写入。不要直接修改数据库中的账号凭据，也不要在日志、工单或代码仓库中记录凭据明文。

## 一、基础约定

示例服务地址为 `https://your-domain.example`，请求和响应默认使用 JSON。

### 管理 API 鉴权

所有 `/adminapi/*` 请求必须携带：

```http
apiauth: <APIAUTH>
```

`APIAUTH` 未配置、未携带或不匹配时，服务返回 HTTP `403` 和文本 `forbidden`。部署时应使用至少 32 位随机值，并通过内网、反向代理访问控制或 IP 白名单限制 `/adminapi/*`。

管理 API 的常规成功响应格式为（部分操作不返回 `data`）：

```json
{"code":1000,"message":"success","data":{}}
```

`code=1000` 表示成功；其它值应按失败处理并记录 `message`，但不得记录请求中的密码、Session Key 或用户 Token。

## 二、管理 API

### 通用操作

下列模块支持相同的 CRUD 路径：

| 模块 | 路径前缀 | 用途 |
| --- | --- | --- |
| Claude 账号 | `/adminapi/claude/session` | 添加、查询和维护共享账号 |
| 平台用户 | `/adminapi/claude/user` | 添加、查询和维护登录 Token |
| 代理池 | `/adminapi/claude/proxypool` | 添加、查询和维护代理 |

| 操作 | 方法与路径 | 最小请求 |
| --- | --- | --- |
| 分页 | `POST {prefix}/page` | `{"page":1,"size":20}` |
| 列表 | `POST {prefix}/list` | `{}` |
| 详情 | `GET {prefix}/info?id=<ID>` | 无请求体 |
| 新增 | `POST {prefix}/add` | 见对应模块 |
| 修改 | `POST {prefix}/update` | 必须包含 `id` |
| 删除 | `POST {prefix}/delete` | `{"ids":[<ID>]}` |

分页和列表可按需传入过滤条件；调用方不应依赖未在本文列出的内部字段。

### 添加 Claude 账号

```http
POST /adminapi/claude/session/add
Content-Type: application/json
apiauth: <APIAUTH>
```

```json
{
  "email": "<ACCOUNT_EMAIL>",
  "password": "<ACCOUNT_PASSWORD>",
  "carID": "<UNIQUE_ACCOUNT_ID>",
  "officialSession": "<CLAUDE_SESSION_KEY>",
  "proxyURL": ""
}
```

`email`、`password`、`carID` 和 `officialSession` 必填；`email` 与 `carID` 必须唯一。`proxyURL` 可省略：为空时账号直连，并可参与代理池自动分配；填写具体代理后以手工值为准。

新增后账号会异步校验，调用方可通过 `info`、`list` 或 `page` 查看 `status` 和 `hasCredential`。查询响应不会返回密码或 Session Key。

### 修改、删除与轮换凭据

普通修改示例：

```json
{"id":51,"remark":"<REMARK>","proxyURL":"<PROXY_URL>","sort":1,"status":true}
```

`update` 不接受 `password` 或 `officialSession`。轮换已有账号的 Session Key 必须使用：

```http
POST /adminapi/claude/session/rotateCredential
Content-Type: application/json
apiauth: <APIAUTH>
```

```json
{"id":51,"officialSession":"<NEW_CLAUDE_SESSION_KEY>"}
```

成功返回 `code=1000`。删除账号使用通用 `delete` 路径。

### 平台用户与代理池

平台用户新增至少需要 `userToken` 和 `expireTime`，常用可选字段为 `isPro`、`remark`。默认情况下 `userToken` 必须唯一。

代理池新增至少需要唯一的 `proxyURL`，可选字段为 `status`、`remark`。支持的 URL 形式包括 `http://`、`https://`、`socks5://` 和 `socks5h://`；代理分配和手工覆盖规则见 [README.md](./README.md#代理配置)。

## 三、用户接入接口

这些接口用于登录页或外部用户系统，不使用 `apiauth`。必须通过 HTTPS 提供服务，并按用户 Token 的敏感程度保护访问日志。

| 接口 | 参数 | 用途 |
| --- | --- | --- |
| `GET` 或 `POST /userinfo` | `usertoken` | 查询本地用户状态和到期时间 |
| `POST /oauth` | `usertoken`，可选 `carid` | 使用本地用户表校验登录；未指定账号时自动选择 |
| `GET` 或 `POST /logintoken` | `usertoken`，可选 `carid`、`resptype` | 建立浏览器会话；默认跳转到 `/new` |

`/userinfo` 成功时返回 `code=1`，`data` 包含 `expireTime`、`isExpired`、`remainingSeconds`、`isPro` 和 `remark`。空值或过长 Token 返回 HTTP `400`；超过单 IP 30 次/分钟或单 Token 60 次/分钟时返回 HTTP `429`，并携带 `Retry-After: 60`。

`/oauth` 成功时返回 `code=1`，以及 `carid`、`expireTime` 和 `isPro`；业务失败通常返回 HTTP `200` 且 `code=0`。

`/logintoken` 默认在成功后写入登录 Session 并返回 HTTP `302`。服务端对接可传 `resptype=json`，成功时返回 `{"code":1,"msg":"登录成功"}`。浏览器直登链接中的 Token 可能进入代理访问日志，应限制日志访问并设置合理的保留期。

## 四、可选外部回调

### 第三方登录 `OAUTH_URL`

设置 `OAUTH_URL` 后，登录流程会向该地址发送表单 `POST`：

```text
usertoken=<USER_TOKEN>
carid=<ACCOUNT_ID>
```

允许登录时返回：

```json
{"code":1,"msg":"登录成功","expireTime":"<EXPIRY_TIME>"}
```

`code` 不为 `1` 时拒绝登录。外部系统也可以在响应中返回 `usertoken` 或 `carid` 以替换原值。登录请求会等待该接口返回，因此该端点应低延迟且高可用。

### 对话前审核 `AUDIT_LIMIT_URL`

设置后，服务会在对话请求发往上游前同步 `POST` 经敏感字段清理的聊天请求 JSON。请求包含以下头：

```http
Authorization: Bearer <USER_TOKEN>
Carid: <ACCOUNT_ID>
Content-Type: application/json
```

请求还可能携带原请求的 `Referer` 和 `User-Agent`。只有 HTTP `200` 会放行；接收端返回其它状态码时，其状态码和响应体会返回给用户；连接失败时本次对话返回 HTTP `400`。部署时应为该端点设置独立的可用性监控。

### 对话完成通知 `CON_NOTIFY_URL`

设置后，服务会在对话完成后异步 `POST`：

```json
{
  "uuid": "<CONVERSATION_ID>",
  "model": "<MODEL>",
  "request": "<USER_REQUEST>",
  "response": "<MODEL_RESPONSE>"
}
```

`response` 是模型返回的 SSE 流文本；`request` 和 `response` 各自最多 4 MiB，超出部分会截断。请求头与审核回调一致，超时为 30 秒；服务不根据接收端 HTTP 状态重试，连接错误只写入服务端日志，不影响已完成的对话。

## 五、相关配置

常用部署参数见 [README.md](./README.md#常用部署参数)。与本文接口直接相关的配置如下：

| 变量 | 默认行为 | 作用 |
| --- | --- | --- |
| `PORT` | `8001` | 容器内 HTTP 监听端口 |
| `APIAUTH` | 空；拒绝所有 `/adminapi/*` | 管理 API 共享密钥 |
| `OAUTH_URL` | `http://127.0.0.1:<PORT>/oauth` | 第三方登录校验地址 |
| `AUDIT_LIMIT_URL` | 空；关闭 | 对话前同步审核地址 |
| `CON_NOTIFY_URL` | 空；关闭 | 对话完成异步通知地址 |
| `SESSION_MAX_AGE` | `720` | 登录 Session 有效期，单位小时 |
| `PROHIBIT_MULTIPLE_LOGIN` | `false` | 是否禁止同一 Token 多处登录 |
| `ALLOW_DUPLICATE_USER_TOKEN` | `false` | 是否允许重复用户 Token |
| `TRUST_PROXY_HEADERS` | `true` | 是否信任反向代理提供的客户端 IP；服务直连公网时应设为 `false` |

修改环境变量后需要重新创建服务容器。

## 六、常见错误

| 现象 | 检查项 |
| --- | --- |
| `/adminapi/*` 返回 `403 forbidden` | `APIAUTH` 是否在服务端配置，调用值是否完全一致 |
| HTTP `200` 但 `code` 表示失败 | 检查 `message`/`msg` 和必填字段；不要只判断 HTTP 状态 |
| `/userinfo` 返回 `429` | 按 `Retry-After` 等待，并检查反向代理真实 IP 配置 |
| 登录失败或超时 | 检查 `OAUTH_URL` 连通性、响应 JSON、`expireTime` 和可用账号 |
| 对话在发送前被拒绝 | 检查 `AUDIT_LIMIT_URL` 的状态码、响应体和可用性 |
| 通知未到达 | 检查 `CON_NOTIFY_URL`、服务日志及接收端 30 秒内响应情况 |
