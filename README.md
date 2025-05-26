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

## 授权相关

- 请运行一次你的程序,随后在
```bash
ddclaude-share-server-deploy/data/ddclaude-share-server-server/
```
中的 hardware_id.txt 中复制出硬件 id 发送给我进行授权

- 授权费用 

# 75 元/月

- 授权联系

![微信二维码](https://github.com/lyy0709/ddclaude-share-sever-deploy/blob/main/images/wechat.jpg)

## 示例图片

- list 选车前端

![list](https://github.com/lyy0709/ddclaude-share-sever-deploy/blob/main/images/list.png)

- admin 管理后台

![admin](https://github.com/lyy0709/ddclaude-share-sever-deploy/blob/main/images/admin.png)


