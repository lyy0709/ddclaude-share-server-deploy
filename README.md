# ddclaude-share-server-deploy

- ddclaude-share-server的部署
- 本项目不依赖网关，可选择性使用
- 本项目支持对话本地化保存

## 更新日志
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
curl -sSfL https://raw.githubusercontent.com/lyy0709/ddclaude-share-sever-deploy/refs/heads/main/quick-install.sh -o quick-install.sh
chmod +x quick-install.sh
./quick-install.sh
```

更新服务

```bash
cd ddclaude-share-server-deploy
chmod +x deploy.sh
./deploy.sh
```

- 如果出现 ip 被墙,可以尝试使用`docker-compose-warp.yml`中含有 warp 的配置

## 代理配置

- 进入后台填写对每个代理相关信息
- 支持 https,http,socks 代理,有无密码均可,如使用 warp 可填写socks5://warp:1080
- 留空则默认走本地,填入代理默认使用代理,如配置网关则最优先使用网关,如果您的网关需要白名单,则请不要填写代理,同时填写代理与网关默认为使用代理请求网关

## 限速服务以及对话审核

参考项目[https://github.com/lyy0709/auditlimit](https://github.com/lyy0709/auditlimit)

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

- 如之前部署过dddd-deploy，可在compose中增加挂载两个只读目录，具体参考本项目，重新启动厚会在相应目录生成硬件码

- 授权费用 

# 75元/月授权（无指导）
# 75元/月授权+500元（含指导+代部署）

- 授权联系

![微信二维码](https://raw.githubusercontent.com/lyy0709/lyy0709/refs/heads/main/img/IMG_8139.jpeg)

## 示例图片

- list 选车前端

![list](https://github.com/lyy0709/ddclaude-share-sever-deploy/blob/main/images/list.png)

- admin 管理后台

![admin](https://github.com/lyy0709/ddclaude-share-sever-deploy/blob/main/images/admin.png)


