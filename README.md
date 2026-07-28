# ddclaude-share-server-deploy

- ddclaude-share-server的部署
- 本项目不依赖网关，可选择性使用
- 本项目支持对话本地化保存

## 更新日志
- 20260729 适配 Claude Web 新版 Project 与对话接口，项目列表、详情、对话归属和删除状态会同步到本地；项目归档保持禁用。代理池自动分配现在只处理当前未填写代理的账号，已有代理绑定不会因健康检查、禁用或池配置变化被自动替换；手动填写的代理优先级最高，清空后账号会重新进入自动分配范围。新增 Claude Web Skills 只读透传和 MCP 写操作两个可选开关，默认保持关闭；同时修复 zstd 响应解压和资源预加载链接绕过反代的问题。升级时数据库字段与索引由服务启动过程自动补齐，无需手工执行 SQL。
- 20260717 **重大安全更新**：账号 sessionkey 改为加密存储、安全性显著增强（数据库不再保留明文）；首次迁移与冷启动性能大幅优化（跳过大表全表扫描、清理过期软删除数据）；审计日志支持获取**真实客户端 IP**（智能兼容 Cloudflare 与国内自建反代）；新增《[外部系统安全对接 API 文档](./API.md)》；修复新增账号返回 `400 invalid sort parameters`、时间校验时间源失效等问题。**升级后请务必通过 API/后台写账号，勿直接写库。**
- 20260520 新增 MCP 目录代理支持，拆分对话级路由处理
- 20260505 优化账号指纹绑定与上游请求重试处理
- 20260424 修复长期运行的内存与资源泄露问题
- 20260417 新增 SOCKS5 代理桥接、Cookie 持久化与上游请求重试
- 20260412 增强代理池故障转移与会话管理
- 20260405 新增代理池与账号批量导入功能
- 20260303 完善上游错误处理与 Cookie 缓存，新增批量事件日志端点，优化 API 代理
- 20260213 新增 Pro 账号用量检查与限速处理；对话记录增加 email 关联与历史迁移
- 20260109 选车页新增并发状态检查与分页优化
- 20260106 更新，增加账号删除或者封号的页面读取，增加参数CONV_FULL_REDIRECT，默认为 false，设置为 true 后会移除对话列表里存在的账号封号或者删除的号
- 20251124 更新内容储存，使用gzip保证能存储更大的内容，更新mysql配置(如果出现丢失对话的情况请更新 compose 配置）
- 20251118 更新屏蔽支付接口，更新一些claude接口
- 20251004 修复了部分文件上传异常的问题
- 20251003 重写了一些页面的刷新逻辑，修复了提示无法正常显示的问题，停运增加了模型显示
- 20250904 修复project 创建问题，，增加了 project 的删除，修复某些接口
- 20250825 更新project接口，适配新接口
- 20250704 支持project，存在bug，project中上传图片问题
- 20250603 增加jwt secret更新脚本，请之前部署的运行一次以防泄露
- 20250601 修复异常退出的情况，增加对每一个账号的代理支持
- 20250527 增加max账号的前端显示
- 20250524 修复偶尔出现的画布错误提示
- 20250521 抛弃origin参数
- 20250429 修复预览时需要额外刷新一次的bug
- 20250428 增加超时机制
- 20250321 支持网关，填入chatproxy中
- 20250315 first commit
## 快速部署
**务必**前往`docker-compose.yml`文件修改相关配置

```bash
curl -sSfL https://raw.githubusercontent.com/lyy0709/ddclaude-share-server-deploy/refs/heads/main/quick-install.sh -o quick-install.sh
chmod +x quick-install.sh
./quick-install.sh
```

## 升级服务

升级前请先备份数据库和部署配置。下面的命令从容器环境变量读取数据库账号，不会把密码直接写进命令：

```bash
cd ddclaude-share-server-deploy
mkdir -p backup
docker compose exec -T mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' > "backup/cool-$(date +%Y%m%d-%H%M%S).sql"
cp docker-compose.yml config.yaml backup/
```

普通 Compose 部署：

```bash
chmod +x deploy.sh
./deploy.sh
docker compose logs --tail=200 dddd-share-server
```

WARP Compose 部署：

```bash
docker compose -f docker-compose-warp.yml pull
docker compose -f docker-compose-warp.yml up -d --remove-orphans
docker compose -f docker-compose-warp.yml logs --tail=200 ddclaude-share-server-server
```

- 启动时会自动执行幂等数据库迁移，补齐 Project、对话和代理关联字段及索引，无需手工执行 SQL。请等待服务启动完成后再开放流量。
- 如果出现 IP 被墙，可以尝试使用 `docker-compose-warp.yml`；该配置要求 Linux 主机提供 `/dev/net/tun`，并需要 `NET_ADMIN` 等权限。

## 代理配置

- 进入后台填写对每个代理相关信息
- 支持 https,http,socks 代理,有无密码均可,如使用 warp 可填写socks5://warp:1080
- 留空则默认走本地,填入代理默认使用代理,如配置网关则最优先使用网关,如果您的网关需要白名单,则请不要填写代理,同时填写代理与网关默认为使用代理请求网关
- 自动分配只会处理当前 `proxyURL` 为空的可用账号，并优先选择健康、启用且当前绑定账号数较少的代理。
- 自动分配完成后，账号与代理保持固定绑定；代理变为不健康、被禁用或修改代理池配置都不会自动改写已有账号。
- 管理员手动填写或更换账号代理时，以手动值为准；手动清空后该账号恢复为直连/无代理状态，并可在下一次自动分配时重新绑定。
- 配置 `CHATPROXY` 网关后，代理池自动分配会跳过；账号已有代理时，请求会使用该代理连接网关。

## 常用部署参数

以下参数均通过 Compose 的 `environment` 配置。未填写时使用表中的默认行为：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `CHATPROXY` | 空 | Claude Web 上游网关地址；配置后跳过代理池自动分配 |
| `LICENSE_CODE` | 空 | 服务授权码 |
| `APIAUTH` | 空 | `/adminapi/*` 共享密钥；为空时管理 API 全部拒绝 |
| `OAUTH_URL` | 本服务 `/oauth` | 第三方用户系统登录回调 |
| `AUDIT_LIMIT_URL` | 空 | 对话前同步审核/限流回调 |
| `CON_NOTIFY_URL` | 空 | 对话完成后的异步通知回调 |
| `SESSION_MAX_AGE` | `720` | 登录会话有效期，单位小时 |
| `PROHIBIT_MULTIPLE_LOGIN` | `false` | 是否禁止同一用户 token 多处同时登录 |
| `ALLOW_DUPLICATE_USER_TOKEN` | `false` | 是否允许多条用户记录使用相同 token |
| `TRUST_PROXY_HEADERS` | `true` | 是否信任可信反代传入的真实客户端 IP；服务直连公网时建议设为 `false` |
| `CLAUDE_WEB_SKILLS_READ_THROUGH` | `false` | 是否只读透传 Claude Web Skills 列表；默认返回空数组 |
| `CLAUDE_WEB_MCP_MUTATIONS` | `false` | 是否允许 Claude Web MCP 写操作；默认只开放已知只读接口 |

## 限速服务以及对话审核

参考项目[https://github.com/lyy0709/auditlimit](https://github.com/lyy0709/auditlimit)

## 外部系统 API 对接

- 部署与外部系统对接接口（`/adminapi` 账号/用户/代理管理、用户登录、审计 / 对话通知回调等）见 **[API.md](./API.md)**。
- ⚠️ 账号 sessionkey 经安全处理存储，**请务必通过 API 接口或后台写入账号，切勿直接读写数据库**（明文列已移除，直接写库要么失败、要么产生不可用的脏数据）。
- `/adminapi/*` 用 `APIAUTH` 请求头鉴权，务必使用强随机密钥并仅内网 / 白名单开放。

## oauth第三方对接

配置环境变量

```yml
OAUTH_URL: https://xxxxx.xxx.com/oauth
```

当该值被配置后，用户登陆时将向该地址 POST 以下数据

```
userToken: 用户Token
carid: 用户选择的账号
```

允许用户登陆接口应返回 json 数据

```json
{
  "code": 1,
  "msg": "登陆成功时的提示信息",
  "expireTime": "2023-05-09 12:00:00",
}
```

其中 code 为 1 时表示允许登陆，其他值表示不允许登陆

msg 为登陆成功/失败时的提示信息

expireTime为用户剩余时间

## 授权相关

- 请运行一次你的程序,随后在
```bash
ddclaude-share-server-deploy/data/ddclaude-share-server-server/
```
中的 hardware_id.txt 中复制出硬件 id 发送给我进行授权

- 授权填写在 compose 中的LICENSE_CODE中

- 如之前部署过 dddd-deploy，可在 compose 中增加挂载两个只读目录，具体参考本项目，重新启动后会在相应目录生成硬件码

- 授权费用

# 75元/月授权（无指导）
# 75元/月授权+500元（含指导+代部署）

- 授权联系

![微信二维码](https://raw.githubusercontent.com/lyy0709/lyy0709/refs/heads/main/img/IMG_8139.jpeg)

## 示例图片

- list 选车前端

![list](https://github.com/lyy0709/ddclaude-share-server-deploy/blob/main/images/list.png)

- admin 管理后台

![admin](https://github.com/lyy0709/ddclaude-share-server-deploy/blob/main/images/admin.png)








