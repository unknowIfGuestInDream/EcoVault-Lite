# EcoVault Lite 部署说明

## 目标机要求

- Node.js 24 与 npm 已安装。
- 目标机可访问部署目录，默认目录为 `/opt/ecovault-lite`。
- 健康检查端点为 `/health`，默认端口为 `8100`。

## 常用环境变量

请在目标机以环境变量或服务管理器配置注入，以下仅为占位示例：

```bash
export ECOVAULT_JWT_SECRET="<请填写 JWT 签名密钥>"
export ECOVAULT_CRYPTO_SECRET="<请填写数据加密密钥>"
export ECOVAULT_ADMIN_USERNAME="<请填写管理员用户名>"
export ECOVAULT_ADMIN_PASSWORD="<请填写管理员初始密码>"
export ECOVAULT_PORT="8100"
export DEPLOY_DIR="/opt/ecovault-lite"
```

## 部署方式

流水线会生成 `ecovault-lite-*.tgz`，并调用：

```bash
bash deploy/deploy.sh
```

脚本会依次停止旧服务、备份旧版本、部署新制品、启动服务并检查 `/health`。

## 回滚方式

备份文件默认保存在 `${DEPLOY_DIR}-backups`。需要回滚时，先停止当前服务，再将目标备份包解压回部署目录，最后用服务管理器或 `node src/server.js` 重新启动。示例：

```bash
export DEPLOY_DIR="/opt/ecovault-lite"
export BACKUP_FILE="${DEPLOY_DIR}-backups/ecovault-lite-<时间戳>.tar.gz"

if [ -f "${DEPLOY_DIR}/ecovault-lite.pid" ]; then
  kill "$(cat "${DEPLOY_DIR}/ecovault-lite.pid")" || true
  rm -f "${DEPLOY_DIR}/ecovault-lite.pid"
fi
rm -rf "${DEPLOY_DIR}"
tar -xzf "${BACKUP_FILE}" -C "$(dirname "${DEPLOY_DIR}")"
cd "${DEPLOY_DIR}"
nohup node src/server.js >> logs/ecovault-lite.log 2>&1 &
echo $! > ecovault-lite.pid
```
