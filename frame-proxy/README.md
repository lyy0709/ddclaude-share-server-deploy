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
- 文件流式传输且不落盘、不缓存；为替换运行时允许来源，HTML 会短暂驻留内存。
  单份 HTML 限制 16 MiB，同时最多处理两份；容器内存上限 256 MiB。
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
