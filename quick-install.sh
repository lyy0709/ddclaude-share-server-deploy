#!/bin/bash
set -e

## 克隆仓库到本地
echo "clone repository..."
git clone https://github.com/dddd-dddd-dddd/dddd-deploy.git dddd-deploy

## 进入目录
cd dddd-deploy

docker compose pull
docker compose up -d --remove-orphans

## 提示信息
echo "服务启动成功，请访问 http://localhost:8300"
echo "管理员后台地址 http://localhost:8300/lyy0709"
echo "管理员账号: admin"
echo "管理员密码: 123456"
echo "请及时修改管理员密码"
