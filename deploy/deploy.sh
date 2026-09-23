#!/usr/bin/env bash
set -euo pipefail

# EcoVault Lite 单机部署脚本：停止旧服务、备份旧版本、部署新制品、启动服务并执行健康检查。
APP_NAME="ecovault-lite"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/ecovault-lite}"
BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_DIR}-backups}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${ECOVAULT_PORT:-8100}/health}"
PID_FILE="${PID_FILE:-${DEPLOY_DIR}/${APP_NAME}.pid}"
LOG_DIR="${LOG_DIR:-${DEPLOY_DIR}/logs}"
LOG_FILE="${LOG_FILE:-${LOG_DIR}/${APP_NAME}.log}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-2}"
WORKSPACE_DIR="$(pwd)"

# 安装生产依赖。优先使用锁定文件确保依赖可复现；制品不含锁定文件时降级为普通安装。
install_production_dependencies() {
  if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
    npm ci --omit=dev
  else
    echo "未找到依赖锁定文件，使用 npm install --omit=dev 安装生产依赖。"
    npm install --omit=dev
  fi
}

# 防止误把当前工作区直接作为部署目录，避免清理部署目录时影响流水线工作区。
if [ "$(realpath -m "${DEPLOY_DIR}")" = "$(realpath -m "${WORKSPACE_DIR}")" ]; then
  echo "部署目录不能与当前工作区相同：${DEPLOY_DIR}"
  exit 1
fi

# 步骤一：停止旧服务。若 PID 文件不存在或进程已退出，则直接跳过。
if [ -f "${PID_FILE}" ]; then
  OLD_PID="$(cat "${PID_FILE}" || true)"
  if [ -n "${OLD_PID}" ] && kill -0 "${OLD_PID}" 2>/dev/null; then
    echo "正在停止旧服务，PID：${OLD_PID}"
    kill "${OLD_PID}"
    for _ in $(seq 1 15); do
      if kill -0 "${OLD_PID}" 2>/dev/null; then
        sleep 1
      else
        break
      fi
    done
    if kill -0 "${OLD_PID}" 2>/dev/null; then
      echo "旧服务未在预期时间内退出，执行强制停止。"
      kill -9 "${OLD_PID}"
    fi
  else
    echo "PID 文件存在但进程未运行，跳过停止步骤。"
  fi
  rm -f "${PID_FILE}"
else
  echo "未发现 PID 文件，跳过停止旧服务。"
fi

# 步骤二：备份旧版本。部署目录存在时打包到带时间戳的备份目录。
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
if [ -d "${DEPLOY_DIR}" ] && [ -n "$(find "${DEPLOY_DIR}" -mindepth 1 -print -quit 2>/dev/null)" ]; then
  mkdir -p "${BACKUP_DIR}"
  BACKUP_FILE="${BACKUP_DIR}/${APP_NAME}-${TIMESTAMP}.tar.gz"
  echo "正在备份旧版本到：${BACKUP_FILE}"
  tar -czf "${BACKUP_FILE}" -C "$(dirname "${DEPLOY_DIR}")" "$(basename "${DEPLOY_DIR}")"
else
  echo "未发现可备份的旧版本，跳过备份。"
fi

# 步骤三：部署新制品。优先解压流水线传入的最新 tgz；若没有制品，则复制当前源码并安装生产依赖。
ARTIFACT="$(ls -t "${WORKSPACE_DIR}"/${APP_NAME}-*.tgz 2>/dev/null | head -n 1 || true)"
rm -rf "${DEPLOY_DIR}"
mkdir -p "${DEPLOY_DIR}"
if [ -n "${ARTIFACT}" ]; then
  echo "正在解压部署制品：${ARTIFACT}"
  tar -xzf "${ARTIFACT}" -C "${DEPLOY_DIR}" --strip-components=1
else
  echo "未找到部署制品，改为复制当前源码。流水线通常会先生成并传入 ${APP_NAME}-*.tgz。"
  tar \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='coverage' \
    --exclude='reports' \
    --exclude='*.tgz' \
    -cf - \
    -C "${WORKSPACE_DIR}" . | tar -xf - -C "${DEPLOY_DIR}"
fi
(cd "${DEPLOY_DIR}" && install_production_dependencies)

# 步骤四：启动服务。生产环境也可改为 systemd 托管，此处使用 nohup 满足单机脚本部署。
mkdir -p "$(dirname "${PID_FILE}")" "${LOG_DIR}"
echo "正在启动服务，日志文件：${LOG_FILE}"
(
  cd "${DEPLOY_DIR}"
  nohup node src/server.js >>"${LOG_FILE}" 2>&1 &
  echo $! >"${PID_FILE}"
)

# 步骤五：健康检查。按固定间隔访问 /health，直到成功或超时。
echo "正在执行健康检查：${HEALTH_URL}"
for attempt in $(seq 1 "${HEALTH_RETRIES}"); do
  if curl -fsS "${HEALTH_URL}" >/dev/null; then
    echo "服务启动成功，健康检查通过。"
    exit 0
  fi
  echo "健康检查第 ${attempt}/${HEALTH_RETRIES} 次未通过，等待 ${HEALTH_INTERVAL} 秒后重试。"
  sleep "${HEALTH_INTERVAL}"
done

echo "服务启动失败，健康检查超时。请查看日志：${LOG_FILE}"
exit 1
