#!/bin/bash

# UAT 環境部署腳本
# 使用方法: ./deploy-uat.sh

set -e  # 遇到錯誤立即退出

echo "🚀 開始部署 Picklevibes UAT 環境..."

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置
APP_DIR="/var/www/picklevibes-uat"
PM2_APP_NAME="picklevibes-uat"

# 函數：顯示成功訊息
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 函數：顯示警告訊息
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 函數：顯示錯誤訊息
error() {
    echo -e "${RED}✗ $1${NC}"
}

# 檢查是否在正確的目錄
if [ ! -d "$APP_DIR" ]; then
    error "應用目錄不存在: $APP_DIR"
    exit 1
fi

cd $APP_DIR

# 1. 備份當前版本
echo "📦 備份當前版本..."
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r server $BACKUP_DIR/
cp -r client/build $BACKUP_DIR/ 2>/dev/null || true
success "備份完成"

# 2. 拉取最新代碼
echo "📥 拉取最新代碼..."
git fetch origin
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "uat" ]; then
    warning "當前不在 uat 分支，切換中..."
    git checkout uat
fi
git pull origin uat
success "代碼更新完成"

# 3. 安裝後端依賴
echo "📦 安裝後端依賴..."
npm install --production
success "後端依賴安裝完成"

# 4. 安裝前端依賴並構建
echo "📦 安裝前端依賴並構建..."
cd client
npm install
npm run build
cd ..
success "前端構建完成"

# 5. 運行數據庫遷移（如果有）
echo "🗄️  檢查數據庫遷移..."
# 這裡可以添加數據庫遷移腳本
# node server/migrations/run.js
success "數據庫遷移完成"

# 6. 重啟應用
echo "🔄 重啟應用..."
pm2 restart $PM2_APP_NAME || pm2 start ecosystem.config.uat.js

# 等待應用啟動
sleep 5

# 7. 檢查應用狀態
echo "🔍 檢查應用狀態..."
if pm2 show $PM2_APP_NAME | grep -q "online"; then
    success "應用運行正常"
else
    error "應用啟動失敗"
    pm2 logs $PM2_APP_NAME --err --lines 20
    exit 1
fi

# 8. 健康檢查
echo "🏥 執行健康檢查..."
HEALTH_URL="http://localhost:5009/api/health"
if curl -f -s $HEALTH_URL > /dev/null; then
    success "健康檢查通過"
else
    error "健康檢查失敗"
    exit 1
fi

# 9. 顯示應用信息
echo ""
echo "📊 應用信息:"
pm2 show $PM2_APP_NAME

# 10. 顯示最近日誌
echo ""
echo "📝 最近日誌:"
pm2 logs $PM2_APP_NAME --lines 20 --nostream

echo ""
success "🎉 UAT 環境部署完成！"
echo ""
echo "訪問地址:"
echo "  前端: https://uat.picklevibes.hk"
echo "  API: https://api-uat.picklevibes.hk"
echo ""
echo "監控命令:"
echo "  查看狀態: pm2 status"
echo "  查看日誌: pm2 logs $PM2_APP_NAME"
echo "  重啟應用: pm2 restart $PM2_APP_NAME"
echo ""

