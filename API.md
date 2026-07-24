# ddclaude-share-server 外部系统安全对接 API 文档

> 面向对接方（账号管理系统、用户系统、审计系统）的接口规范。
>
> **核心原则：账号凭证（sessionkey）经安全处理后存储，不以明文保存。任何写入账号的操作都必须走本文档中的接口，切勿直接读写数据库。**

---

## 目录

- [一、鉴权分层](#一鉴权分层)
- [二、adminapi 鉴权](#二adminapi-鉴权)
- [三、账号管理接口 /adminapi/claude/session](#三账号管理接口-adminapiclaudesession)
- [四、其它管理接口](#四其它管理接口)
- [五、用户登录 / 查询接口](#五用户登录--查询接口)
- [六、出站 Webhook（由外部系统实现）](#六出站-webhook由外部系统实现)
- [七、OAuth 第三方登录对接](#七oauth-第三方登录对接)
- [八、代理接口 /api/*（用户侧，说明）](#八代理接口-api用户侧说明)
- [九、外部系统安全对接规范（务必阅读）](#九外部系统安全对接规范务必阅读)
- [十、相关环境变量](#十相关环境变量)

---

## 一、鉴权分层

| 通道 | 路径前缀 | 鉴权方式 | 用途 |
|---|---|---|---|
| **管理 API** | `/adminapi/*` | `apiauth` 请求头（共享密钥） | **外部系统对接账号/用户/代理管理，本文档重点** |
| Web 管理后台 | `/admin/*` | 管理员登录态 | 人工登录的管理后台 |
| 用户侧 | `/api/*`、`/oauth`、`/logintoken` 等 | 登录后的 Session Cookie | 终端用户使用 |

**凭证存储说明：**
- 账号 `officialSession`（Claude sessionkey）经安全处理后存储，**数据库中不保留明文**。
- 因此**直接对数据库写入 sessionkey 是无效的**：要么写入失败，要么产生一份不被系统使用的无效数据。
- **请一律通过下面的接口写入 / 变更账号，系统会自动完成安全存储。**

---

## 二、adminapi 鉴权

所有 `/adminapi/*` 请求必须携带请求头：

```
apiauth: <APIAUTH 环境变量的值>
```

- 若服务端 `APIAUTH` 未配置 → 所有 `/adminapi/*` 返回 **403 Forbidden**（fail‑closed）。

> ⚠️ **安全要求**：`APIAUTH` 必须使用**高强度随机值（≥32 位）**，切勿使用用户名、域名等可猜测的弱值；并强烈建议 `/adminapi/*` **仅对内网 / IP 白名单开放**，不要直接暴露到公网。

**通用响应包裹（Cool Admin 风格）：**

```json
{ "code": 1000, "message": "success", "data": { ... } }
```

- `code = 1000` 表示成功；其它值表示失败，`message` 为原因。

---

## 三、账号管理接口 /adminapi/claude/session

### 3.0 通用 CRUD 约定

| 操作 | 方法 & 路径 | 请求体 | 返回 `data` |
|---|---|---|---|
| 分页 | `POST /adminapi/claude/session/page` | `{"page":1,"size":20}`（可加 `keyWord`、精确字段过滤） | `{"list":[...],"pagination":{"page","size","total"}}` |
| 列表 | `POST /adminapi/claude/session/list` | `{}`（可加过滤） | `[ ... ]` |
| 详情 | `GET  /adminapi/claude/session/info?id=51` | — | `{ ... }` |
| 新增 | `POST /adminapi/claude/session/add` | 见 3.1 | `{"id":51}` |
| 修改 | `POST /adminapi/claude/session/update` | 见 3.3 | — |
| 删除 | `POST /adminapi/claude/session/delete` | `{"ids":[51,52]}` | — |

> 排序参数：`order`=字段名、`sort`=`asc`/`desc`，仅用于 page/list 查询；写接口 body 里的 `sort` 是账号排序序号（整数），二者互不冲突。

### 3.1 新增账号 `add`

```
POST /adminapi/claude/session/add
apiauth: <KEY>
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "account-password",
  "carID": "a1b2c3d4",
  "officialSession": "sk-ant-sid01-....",
  "proxyURL": "socks5://user:pass@host:port",
  "sort": 0,
  "remark": "备注"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `email` | ✅ | 账号邮箱（唯一） |
| `password` | ✅ | 账号密码 |
| `carID` | ✅ | 展示 ID / 车号（唯一） |
| `officialSession` | ✅ | Claude sessionkey（`sk-ant-` 开头）；提交后由系统安全存储 |
| `proxyURL` | | 代理，支持 `http(s)://`、`socks5://`，可带账号密码 |
| `sort` | | 排序序号 |
| `remark` | | 备注 |

- 返回 `{"code":1000,"data":{"id":51}}`。
- 新增后会**异步校验账号可用性**（登录 Claude），成功后 `status` 置为可用。

### 3.2 查询 `page` / `list` / `info`

响应中的账号对象**不包含 `officialSession` 和 `password`**，改为状态字段：

```json
{
  "id": 51, "carID": "a1b2c3d4", "email": "user@example.com",
  "status": 1, "isPro": 0, "sort": 0, "count": 12,
  "organizationsid": "xxxx", "planType": "chat",
  "proxyURL": "", "proxySource": "direct", "remark": "",
  "hasCredential": 1,
  "createTime": "2026-05-06 12:24:25", "updateTime": "2026-07-17 21:05:52"
}
```

- `hasCredential=1` 表示该账号已配置凭证（`0` 表示尚未配置/无效）。

### 3.3 修改账号 `update`

```json
{ "id": 51, "remark": "新备注", "proxyURL": "...", "sort": 1, "status": 1 }
```

> ⚠️ **`update` 不允许修改 `officialSession` / `password`**，携带这两个字段会返回错误「敏感凭据只能通过专用轮换接口修改」。变更 sessionkey 请用 3.5。

### 3.4 删除账号 `delete`

```json
{ "ids": [51, 52] }
```

### 3.5 变更 sessionkey（凭证轮换）`rotateCredential`

```
POST /adminapi/claude/session/rotateCredential
apiauth: <KEY>
```

```json
{ "id": 51, "officialSession": "sk-ant-sid01-新的sessionkey" }
```

- 成功 `{"code":1000,"message":"凭据已轮换"}`；失败 `{"code":1001,"message":"凭据轮换失败"}`。
- **这是变更已有账号 sessionkey 的唯一入口**，系统会自动完成安全存储并覆盖旧值。

### 3.6 批量导入（仅 Web 后台）

```
POST /admin/claude/session/batchImport   （注意：/admin，需管理员登录，不在 /adminapi 下）
```

```json
{ "text": "user@example.com----password123----sk-ant-xxx----socks5://host:port\n..." }
```

- 每行 `邮箱----密码----sessionkey----代理URL(可选)`；导入后逐个异步校验。
- 外部系统如需批量开户，建议循环调用 3.1 的 `add`。

---

## 四、其它管理接口

均为 `/adminapi/claude/{模块}` 下的标准 CRUD（`page`/`list`/`info`/`add`/`update`/`delete`），鉴权同第二节。

| 模块 | 前缀 | 说明 |
|---|---|---|
| 用户 | `/adminapi/claude/user` | 平台用户（`userToken`、`expireTime`、`isPro`、`remark`、`count`） |
| 对话 | `/adminapi/claude/conversations` | 本地保存的对话记录 |
| 项目 | `/adminapi/claude/projects` | Project 记录 |
| 代理池 | `/adminapi/claude/proxypool` | 代理池条目 |

---

## 五、用户登录 / 查询接口

### 5.1 查询用户信息 `GET|POST /userinfo`

```
GET /userinfo?usertoken=<用户Token>
```

响应：

```json
{
  "code": 1, "msg": "查询成功",
  "data": {
    "userToken": "xxxx", "expireTime": "2026-07-22 11:03:17",
    "isExpired": false, "remainingSeconds": 431999,
    "isPro": true, "remark": ""
  }
}
```

- `code=1` 成功；`code=0` 且 `msg="用户不存在"` 表示无此 token。
- **限流**：单 IP 30 次/分钟、单 token 60 次/分钟，超限返回 `429` 并带 `Retry-After` 头。

### 5.2 登录 `POST /oauth` / `POST /oauthfree`

- `POST /oauth`：参数 `usertoken`、`carid`（可空，自动分配可用账号）。校验用户有效期与 Pro 类型后返回可用的 `carid`。
- 返回：`{"code":1,"msg":"登陆成功","carid":"a1b2c3d4","expireTime":"...","isPro":true}`。

### 5.3 令牌直登 `ALL /logintoken`

```
/logintoken?usertoken=<用户Token>[&carid=<账号>]
```

- 校验 `usertoken`，无 `carid` 时自动挑选使用次数最少的可用账号，写入会话后 302 跳转到 `/new`。用于「一个链接直接登录」场景。

---

## 六、出站 Webhook（由外部系统实现）

以下是本服务**主动 POST 到外部系统**的回调；对接方需实现对应 HTTP 端点并配置环境变量。两者都携带 `Authorization: Bearer <usertoken>`、`Carid: <carid>` 头。

### 6.1 审计 / 限流回调 `AUDIT_LIMIT_URL`

- 触发：用户发起对话补全（completion）**之前**，**同步**调用。
- 方法：`POST`，Body 为聊天请求体。
- **返回 `200` → 放行**；返回**非 `200` → 拦截**，其响应体会原样回传给用户（用于「额度不足 / 触发风控」等提示）。
- 参考实现：<https://github.com/lyy0709/auditlimit>

### 6.2 对话通知回调 `CON_NOTIFY_URL`

- 触发：对话补全**完成后**，**异步**调用（不阻塞用户，30s 超时）。
- 方法：`POST`，Body：

```json
{
  "uuid": "对话UUID",
  "model": "claude-sonnet-4-5-20250929",
  "request": "用户请求内容(超长截断)",
  "response": "模型完整回复(超长截断)"
}
```

- 用于外部系统留存 / 审计对话内容。返回值不影响主流程。

---

## 七、OAuth 第三方登录对接

配置环境变量后启用（用户系统由第三方托管）：

```yaml
OAUTH_URL: "https://your-user-system.com/oauth"
```

配置后，用户登录时本服务会向该地址 `POST`：

```
userToken: 用户Token
carid:     用户选择/分配的账号
```

第三方应返回：

```json
{ "code": 1, "msg": "登陆成功", "expireTime": "2026-05-09 12:00:00" }
```

- `code=1` 允许登录，其它值拒绝；`expireTime` 为该用户剩余有效期。

---

## 八、代理接口 /api/*（用户侧，说明）

`/api/organizations/:orgid/*` 等是转发到 Claude 官方的**代理接口**，由前端在**用户登录会话**下调用，需 Session Cookie，不面向外部系统对接，故此处不展开。要点：

- 统一经登录态校验；
- 响应头统一剥离 `Set-Cookie`，sessionkey 只注入到发往上游的请求、绝不回传浏览器；
- `/v1/messages` 被全局拦截（禁止把共享账号当裸 API Key 刷额度）。

---

## 九、外部系统安全对接规范（务必阅读）

1. **只经接口写账号，禁止直接写库。** 写 sessionkey 必须用 `add`（3.1）或 `rotateCredential`（3.5）。直接写数据库无效（明文列已移除），会产生不可用的脏数据。
2. **`APIAUTH` 用强随机值**，`/adminapi/*` 仅内网 / IP 白名单开放，切勿公网裸奔。
3. **凭证不会经任何响应返回**：`page/list/info` 只返回 `hasCredential` 等状态字段，不返回 `officialSession`/`password`。
4. **变更 sessionkey 只能走 `rotateCredential`**，`update` 携带凭证会被拒绝。
5. **做好数据库与部署卷的备份隔离与访问控制**，仅授权最小必要人员访问。

---

## 十、相关环境变量

| 变量 | 说明 | 建议 |
|---|---|---|
| `APIAUTH` | `/adminapi/*` 的共享密钥 | **必填且用强随机值**，否则 adminapi 全拒 |
| `OAUTH_URL` | 第三方用户系统登录回调 | 见第七节 |
| `AUDIT_LIMIT_URL` | 审计/限流回调（出站，同步） | 见 6.1 |
| `CON_NOTIFY_URL` | 对话通知回调（出站，异步） | 见 6.2 |
| `LICENSE_CODE` | 授权码 | 必填 |
| `SESSION_MAX_AGE` | 会话有效期（小时） | 默认 720 |
| `PROHIBIT_MULTIPLE_LOGIN` | 禁止同一 token 多处登录 | 默认 false |
| `TRUST_PROXY_HEADERS` | 信任 `CF-Connecting-IP`/`X-Forwarded-For` 等取真实 IP | 反代后为 true（默认），直连公网应设 false |
