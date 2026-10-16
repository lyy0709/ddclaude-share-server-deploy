# Claude Frame 隔离预览代理

部署在 `192.3.179.32:/opt/claude-frame-proxy`，使用 `*.frame.chatgpt.ng`。
Cloudflare DNS 记录目前采用 **仅 DNS**：浏览器直接与源站建立 HTTPS，源站使用
Let's Encrypt 公开证书。不要重新开启橙云，除非 Cloudflare 的边缘证书已经明确覆盖
`*.frame.chatgpt.ng`；`*.chatgpt.ng` 不覆盖这一层域名。

## 与 Claude 主站连接

Claude 后端需要运行包含本次修改的版本。默认配置如下，无需额外设置：

```dotenv
FRAME_PROXY_DOMAIN=frame.chatgpt.ng
```

主站对 HTML、JSON、JS 中的 `.frame.claudeusercontent.com` 后缀作通用替换，
保留文档 UUID 和原生 iframe。修改后的静态资源使用 `artifact-live-v2` URL 空间。
该配置不包含协议、`*.`、路径或端口。未设置或值为空时使用 `frame.chatgpt.ng`，
非空环境变量可以覆盖此默认域名。

代理当前只允许以下父页面来源：

```dotenv
FRAME_PARENT_ORIGINS=https://aa.claudechn.com,https://rainj.eu.cc
```

其他主站需要加入精确 HTTPS 来源后重建代理容器。该列表用于 CSP `frame-ancestors`
和原生 `window.__FRAME_PREAMBLE.origins`，不能改成任意来源。代理只接受 UUID 子域名
以及公共字体子域名，固定请求相应官方 Frame 主机，不提供任意 URL 转发功能。

## 授权与传输

- 预览内容仍由官方校验原生短期授权及 `__Host-frame-asset-*`、`__Host-frame-rt-*`
  Cookie；不要丢掉原生 URL 的 `__frame_t`、`v`、`__frame_v` 等参数。
- 保留专用 Cookie 的 Secure、HttpOnly、SameSite 和 Partitioned 属性；不向上游转发
  主站的 Cookie、sessionKey 或 Authorization。
- 代理只处理 GET、HEAD、OPTIONS，不处理主站的账户、元数据、文档同步或编辑接口。
  原归属账号的选择和本站用户的对话权限继续由 Claude 主站后端校验。
- 文件流式传输且不落盘、不缓存；为替换运行时允许来源，HTML 和原生 Docs JavaScript 会短暂驻留内存。
  单份文本限制 16 MiB，同时最多处理两份，其余响应暂停读取等待；容器内存上限 256 MiB。
- 未获得有效授权时保留上游 403，不把错误页面伪装成成功。健康检查通过不等于
  某份文档有可用授权，也不等于主站的所有原生数据接口已经接通。

## 证书与运维

DNS 凭据只保存在服务器 `/root/.secrets/chatgpt-ng-cloudflare.ini`，权限 600，
不会挂载给预览代理。ACME 文件位于 `acme/`，运行时证书位于 `tls/`。
已安装 `claude-frame-renew.timer`，每天检查两次；更新后向 Node 发送 HUP 热加载证书。
首次证书有效期截至 2027-01-04。计时器启用不代表未来续期已经验证成功。

```sh
cd /opt/claude-frame-proxy
docker compose ps
curl -H 'Host: localhost' http://127.0.0.1:8401/healthz
systemctl list-timers claude-frame-renew.timer
journalctl -u claude-frame-renew.service
```

回滚本独立服务可执行 `docker compose down`，并停用 `claude-frame-renew.timer`；
不会操作既有 Grok 容器或 Cloudflare Tunnel。主站若已启用该域名，需要同时恢复其配置。
本次未执行 Claude 项目构建或项目测试；主站更新和跨账号完整页面验收需单独完成。

## 2026-10-06 部署验证

- 公网 HTTPS 与有效授权请求返回 200；无授权返回 403，兑换授权后仅携带 Cookie 返回 200。
- 非许可 Origin 返回 403，POST 返回 405，未知主机返回 421。
- Playwright 在临时 aa 来源父页面中嵌入真实原生 iframe，收到新预览域名发出的
  `__frame_cred`、`__frame_connect`、`__frame_alive`，未出现页面脚本错误。
- 上述嵌入检查使用真实上游内容和有效授权；临时父页面仅用于验证握手，不等于完整
  Claude Docs 页面或跨账号对话验收。aa 线上后端由站点维护方后续更新。
- 当前 aa 文档元数据接口的重新请求返回 404；本次验证使用仍有效的原生链接。
  更新主站后仍需检查原账号实时取源、文档数据接口和跨账号只读策略。

## 2026-10-11 原生 Docs 协议修复

新版 Docs JavaScript 将 `__FRAME_PREAMBLE.origins` 与内置官方来源数组取交集。
代理同时替换原生 `artifact-type/*.js` 中的官方来源数组，使用相同的精确父来源名单，
不依赖脚本构建哈希或压缩变量名。被改写的模块不使用上游条件请求或 Range 响应。
已在 aa 真实对话验证 `NO_SHELL_ORIGIN` 消失并进入 `lane:hello:early`。

主站须同步更新：新增拥有者校验后的 `/api/frame/sync` WebSocket、
`/api/frame/lane/{bongo,journal}/{id}/subscribe` 和 `/api/frame/doc/{id}/{replica,ops}`。
同步授权由服务端通过原账号获取，跨账号只允许已识别的读取消息；写消息仍要求原账号。
这些请求在独立 Frame 代理中不会转发。主站反向代理须支持 WebSocket Upgrade。
本次未执行项目构建或项目测试；aa 主站更新前订阅仍返回 403、同步仍返回 404，
完整正文和跨账号实测尚未完成。

## Nginx 主站 WebSocket 转发

`/api/frame/sync` 需要 WebSocket。若现有反代到 Claude 项目的 `location /` 或
`location /api/` 已支持 WebSocket，无需新增专用 location；否则在实际匹配该请求的
location 中加入以下配置（已有同名指令时修改原行），保持原有 `proxy_pass`、鉴权、
Cookie、Host 和转发协议配置不变：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

这三行是 Nginx 官方给出的基本 WebSocket 转发方式。对于共用 HTTP 与 WebSocket 的
location，推荐在 `http` 块（不放在 `server` 或 `location` 内）定义：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

然后将实际 location 中的 Connection 指令改为：

```nginx
proxy_set_header Connection $connection_upgrade;
```

不要依赖 `Connection $http_connection` 原样传递上一层的 hop-by-hop 连接头。
若现有配置已经包含 HTTP/1.1 和 Upgrade，不能仅凭旧版的统一 403 断言缺少
WebSocket 配置；需确认实际匹配的 location、配置是否重载，以及项目入口前是否还有
HTTP 代理。
若文档连接在空闲 60 秒后断开，可在同一 location 设置
`proxy_read_timeout 1800s;`，与后端现有最长连接时间保持一致。
修改完成后执行 `nginx -t && nginx -s reload`，刷新对话并检查 `/api/frame/sync`
的握手是否返回 `101 Switching Protocols`。不要用删除来源或归属检查来代替转发配置。
参考：https://nginx.org/en/docs/http/websocket.html

2026-10-16 已观察到 aa 浏览器正确发送 Origin、Upgrade 和 `frame-sync.v1`，
主站元数据与订阅接口返回 200，但同步握手仍返回 403。当前旧报错将三项检查混为一谈，
用户随后提供的配置已包含 HTTP/1.1 和 Upgrade，但使用 `Connection $http_connection`；
尚未确认实际加载的配置及后端收到的头，不能仅凭此响应确定哪项校验失败。
新版后端分别返回 `origin_mismatch`（403）、`upgrade_required`（426）和
`protocol_required`（400），同时提供 `X-Frame-Sync-Error` 响应头，便于确认具体环节。
日志只记录原因码，不记录 Cookie、授权子协议值或完整握手头。
