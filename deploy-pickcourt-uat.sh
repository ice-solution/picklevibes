#!/bin/bash
#
# PickCourt UAT 部署腳本（含前端 build + PM2 重啟）
# Apache 設定請另跑：sudo ./scripts/setup-apache-pickcourt-uat.sh
#
# 用法：./deploy-pickcourt-uat.sh
#
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

success() { echo -e "${GREEN}✓ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; exit 1; }

APP_DIR="${PICKCOURT_APP_DIR:-/var/www/html/pickcourt}"
PM2_APP_NAME="${PICKCOURT_PM2_NAME:-pickcourt-uat}"
HEALTH_PORT="${PICKCOURT_API_PORT:-5111}"
GIT_BRANCH="${PICKCOURT_GIT_BRANCH:-uat}"

echo "🚀 開始部署 PickCourt UAT..."

if [ ! -d "$APP_DIR" ]; then
  error "應用目錄不存在: $APP_DIR"
fi

cd "$APP_DIR"

echo "📦 備份當前版本..."
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r server "$BACKUP_DIR/" 2>/dev/null || true
cp -r client/build "$BACKUP_DIR/" 2>/dev/null || true
success "備份完成"

echo "📥 拉取最新代碼..."
git fetch origin
CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "$GIT_BRANCH" ]; then
  warning "當前不在 ${GIT_BRANCH} 分支，切換中..."
  git checkout "$GIT_BRANCH"
fi
git pull origin "$GIT_BRANCH"
success "代碼更新完成"

echo "📦 安裝後端依賴..."
npm install --omit=dev
success "後端依賴安裝完成"

echo "📦 安裝前端依賴並構建（PickCourt UAT）..."
cd client
if [ ! -f .env.pickcourtuat ]; then
  if [ -f .env.pickcourtuat.example ]; then
    warning "缺少 .env.pickcourtuat，從 example 複製（請檢查 API URL / Stripe key）"
    cp .env.pickcourtuat.example .env.pickcourtuat
  else
    error "缺少 client/.env.pickcourtuat，無法 build:pickcourtuat"
  fi
fi
npm install
npm run build:pickcourtuat
cd ..
success "前端構建完成"

echo "🔄 重啟應用..."
pm2 restart "$PM2_APP_NAME" || pm2 start ecosystem.config.pickcourt-uat.js
sleep 5

echo "🔍 檢查應用狀態..."
if pm2 show "$PM2_APP_NAME" | grep -q "online"; then
  success "應用運行正常"
else
  error "應用啟動失敗"
  pm2 logs "$PM2_APP_NAME" --err --lines 20
  exit 1
fi

echo "🏥 執行健康檢查..."
HEALTH_URL="http://127.0.0.1:${HEALTH_PORT}/api/health"
if curl -f -s "$HEALTH_URL" > /dev/null; then
  success "健康檢查通過 (${HEALTH_URL})"
else
  error "健康檢查失敗 (${HEALTH_URL})"
fi

echo ""
success "🎉 PickCourt UAT 部署完成！"
echo ""
echo "訪問："
echo "  https://uat.pickcourt.hk"
echo "  https://lck.uat.pickcourt.hk"
echo ""
echo "Apache（首次或改 port 後）："
echo "  sudo PICKCOURT_API_PORT=${HEALTH_PORT} PICKCOURT_APP_DIR=${APP_DIR} ./scripts/setup-apache-pickcourt-uat.sh"
echo ""
