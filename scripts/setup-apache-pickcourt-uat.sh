#!/bin/bash
#
# PickCourt UAT — Apache2 安裝／更新腳本
#
# 用法：
#   sudo ./scripts/setup-apache-pickcourt-uat.sh
#   sudo ./scripts/setup-apache-pickcourt-uat.sh --ssl
#
# 環境變數（可選）：
#   PICKCOURT_APP_DIR=/var/www/pickcourt     專案根目錄
#   PICKCOURT_API_PORT=5001                  Node API port（與 PM2 / .env PORT 一致）
#   PICKCOURT_APACHE_SITE=pickcourt-uat      sites-available 檔名
#
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

success() { echo -e "${GREEN}✓ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; exit 1; }

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  error "請使用 sudo 執行：sudo $0"
fi

MODE="cloudflare"
if [ "${1:-}" = "--ssl" ]; then
  MODE="ssl"
elif [ "${1:-}" = "--cloudflare" ] || [ -z "${1:-}" ]; then
  MODE="cloudflare"
elif [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "用法: sudo $0 [--cloudflare|--ssl]"
  exit 0
else
  error "未知參數：$1（請用 --cloudflare 或 --ssl）"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PICKCOURT_APP_DIR="${PICKCOURT_APP_DIR:-/var/www/pickcourt}"
PICKCOURT_API_PORT="${PICKCOURT_API_PORT:-5001}"
PICKCOURT_APACHE_SITE="${PICKCOURT_APACHE_SITE:-pickcourt-uat}"
APP_BUILD_DIR="${PICKCOURT_APP_DIR}/client/build"
SITE_AVAILABLE="/etc/apache2/sites-available/${PICKCOURT_APACHE_SITE}.conf"
SITE_ENABLED="/etc/apache2/sites-enabled/${PICKCOURT_APACHE_SITE}.conf"

if [ "$MODE" = "cloudflare" ]; then
  TEMPLATE="${SCRIPT_DIR}/apache-pickcourt-uat-cloudflare-flexible.conf.example"
else
  TEMPLATE="${SCRIPT_DIR}/apache-pickcourt-uat.conf.example"
fi

[ -f "$TEMPLATE" ] || error "找不到範本：$TEMPLATE"

echo "🔧 PickCourt UAT Apache2 設定（模式：${MODE}）"
echo "   專案目錄: ${PICKCOURT_APP_DIR}"
echo "   前端 build: ${APP_BUILD_DIR}"
echo "   API port: ${PICKCOURT_API_PORT}"
echo ""

echo "📦 啟用 Apache 模組..."
a2enmod proxy proxy_http rewrite headers expires deflate remoteip 2>/dev/null || true
a2enmod proxy_wstunnel 2>/dev/null || true
success "模組已啟用"

if [ ! -d "$APP_BUILD_DIR" ]; then
  warning "前端 build 目錄尚未存在：${APP_BUILD_DIR}"
  warning "請先 deploy（npm run build:pickcourtuat）再 reload Apache"
fi

echo "📝 寫入 ${SITE_AVAILABLE} ..."
if [ "$MODE" = "cloudflare" ]; then
  sed \
    -e "s|@APP_ROOT@|${APP_BUILD_DIR}|g" \
    -e "s|@API_PORT@|${PICKCOURT_API_PORT}|g" \
    "$TEMPLATE" > "$SITE_AVAILABLE"
else
  # 直接 HTTPS 範本：修正 Directory 路徑並替換常見佔位
  sed \
    -e "s|/var/www/pickcourt/client/build|${APP_BUILD_DIR}|g" \
    -e "s|/var/www/html/pickcourt/client/build|${APP_BUILD_DIR}|g" \
    -e "s|127.0.0.1:5011|127.0.0.1:${PICKCOURT_API_PORT}|g" \
    -e "s|127.0.0.1:5001|127.0.0.1:${PICKCOURT_API_PORT}|g" \
    "$TEMPLATE" > "$SITE_AVAILABLE"
fi
success "設定檔已寫入"

ln -sf "$SITE_AVAILABLE" "$SITE_ENABLED"
success "已啟用 site：${PICKCOURT_APACHE_SITE}"

echo "🔍 驗證設定..."
apache2ctl configtest
success "configtest 通過"

echo "🔄 重新載入 Apache..."
systemctl reload apache2
success "Apache 已 reload"

echo ""
success "PickCourt UAT Apache 設定完成"
echo ""
echo "下一步："
echo "  1. 確認 DNS：uat.pickcourt.hk、lck.uat.pickcourt.hk、admin.lck.uat.pickcourt.hk"
if [ "$MODE" = "ssl" ]; then
  echo "  2. SSL：sudo certbot --apache -d uat.pickcourt.hk -d lck.uat.pickcourt.hk -d admin.lck.uat.pickcourt.hk"
else
  echo "  2. Cloudflare SSL/TLS 設為 Flexible"
fi
echo "  3. .env：PUBLIC_WEB_URL=https://uat.pickcourt.hk、PORT=${PICKCOURT_API_PORT}、TRUST_PROXY_HOPS=1"
echo "  4. 驗證：cd ${PICKCOURT_APP_DIR} && npm run verify-tenant-domains -- --http --base https://uat.pickcourt.hk"
echo ""
