# claude-share-server-deploy
claude-share-server的部署

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
curl -sSfL https://raw.githubusercontent.com/dddd-dddd-dddd/dddd-deploy/refs/heads/main/quick-install.sh -o quick-install.sh
chmod +x quick-install.sh
./quick-install.sh
```

更新服务

```bash
cd dddd-deploy
chmod +x deploy.sh
./deploy.sh
```

## 免责声明

- 本工具仅供学习和技术研究使用，不得用于任何商业或非法行为，否则后果自负。
- 本工具的作者不对本工具的安全性、完整性、可靠性、有效性、正确性或适用性做任何明示或暗示的保证，也不对本工具的使用或滥用造成的任何直接或间接的损失、责任、索赔、要求或诉讼承担任何责任。
- 本工具的作者保留随时修改、更新、删除或终止本工具的权利，无需事先通知或承担任何义务。
- 本工具的使用者应遵守相关法律法规，尊重微信的版权和隐私，不得侵犯微信或其他第三方的合法权益，不得从事任何违法或不道德的行为。
- 本工具的使用者在下载、安装、运行或使用本工具时，即表示已阅读并同意本免责声明。如有异议，请立即停止使用本工具，并删除所有相关文件。
