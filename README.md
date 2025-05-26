# ddclaude-share-server-deploy

- ddclaude-share-server的部署

## 更新日志
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

更新服务

```bash
cd ddclaude-share-server-deploy
chmod +x deploy.sh
./deploy.sh
```
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

- 授权费用 

# 75 元/月

- 授权联系

![微信二维码](https://raw.githubusercontent.com/lyy0709/lyy0709/refs/heads/main/img/IMG_8139.jpeg)

## 示例图片

- list 选车前端

![list](https://github.com/lyy0709/ddclaude-share-sever-deploy/blob/main/images/list.png)

- admin 管理后台

![admin](https://github.com/lyy0709/ddclaude-share-sever-deploy/blob/main/images/admin.png)


