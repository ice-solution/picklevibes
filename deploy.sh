#!/bin/bash

# PickleVibes 部署腳本
# 作者: Keith Leung
# 用法: sudo bash deploy.sh

set -e

echo "🚀 開始部署 PickleVibes..."

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置變量
PROJECT_DIR="/var/www/html/picklevibes"
APACHE_CONFIG="/etc/apache2/sites-available/picklevibes.conf"
DOMAIN="picklevibes.hk"

# 檢查是否為 root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ 請使用 sudo 運行此腳本${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 步驟 1: 更新系統套件...${NC}"
apt-get update -y

echo -e "${YELLOW}📦 步驟 2: 安裝必要套件...${NC}"
apt-get install -y apache2 nodejs npm git certbot python3-certbot-apache

echo -e "${YELLOW}📦 步驟 3: 啟用 Apache 模組...${NC}"
a2enmod rewrite
a2enmod proxy
a2enmod proxy_http
a2enmod ssl
a2enmod headers
a2enmod expires
a2enmod deflate

echo -e "${YELLOW}📦 步驟 4: 克隆或更新項目...${NC}"
if [ -d "$PROJECT_DIR" ]; then
    echo "項目目錄已存在，執行 git pull..."
    cd $PROJECT_DIR
    git pull origin main
else
    echo "克隆項目..."
    mkdir -p /var/www/html
    cd /var/www/html
    git clone https://github.com/your-username/picklevibes.git
    cd picklevibes
fi

echo -e "${YELLOW}📦 步驟 5: 安裝依賴...${NC}"
npm install

echo -e "${YELLOW}📦 步驟 6: 構建前端...${NC}"
cd client
npm install
npm run build
cd ..

echo -e "${YELLOW}📦 步驟 7: 設置環境變量...${NC}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${RED}⚠️  警告: .env 文件不存在${NC}"
    echo "請創建 .env 文件並設置以下變量："
    echo "  - MONGODB_URI"
    echo "  - JWT_SECRET"
    echo "  - STRIPE_SECRET_KEY"
    echo "  - STRIPE_PUBLISHABLE_KEY"
    echo "  - PORT=5001"
    echo "  - NODE_ENV=production"
    echo "  - CLIENT_URL=https://$DOMAIN"
    read -p "是否現在創建 .env 文件? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        nano $PROJECT_DIR/.env
    fi
fi

echo -e "${YELLOW}📦 步驟 8: 配置 Apache...${NC}"
cp apache-config.conf $APACHE_CONFIG
sed -i "s|/var/www/html/picklevibes/client/build|$PROJECT_DIR/client/build|g" $APACHE_CONFIG
sed -i "s|picklevibes.hk|$DOMAIN|g" $APACHE_CONFIG

echo -e "${YELLOW}📦 步驟 9: 啟用站點...${NC}"
a2ensite picklevibes.conf
a2dissite 000-default.conf

echo -e "${YELLOW}📦 步驟 10: 測試 Apache 配置...${NC}"
apache2ctl configtest

echo -e "${YELLOW}📦 步驟 11: 重啟 Apache...${NC}"
systemctl restart apache2

echo -e "${YELLOW}📦 步驟 12: 安裝 PM2...${NC}"
npm install -g pm2

echo -e "${YELLOW}📦 步驟 13: 啟動後端服務...${NC}"
cd $PROJECT_DIR
pm2 delete picklevibes 2>/dev/null || true
pm2 start server/index.js --name picklevibes --env production
pm2 save
pm2 startup systemd -u root --hp /root

echo -e "${YELLOW}📦 步驟 14: 設置 SSL 證書...${NC}"
read -p "是否設置 Let's Encrypt SSL 證書? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    certbot --apache -d $DOMAIN -d www.$DOMAIN
fi

echo -e "${YELLOW}📦 步驟 15: 設置文件權限...${NC}"
chown -R www-data:www-data $PROJECT_DIR/client/build
chmod -R 755 $PROJECT_DIR/client/build

echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo "📊 服務狀態:"
echo "  - Apache: $(systemctl is-active apache2)"
echo "  - PM2: $(pm2 list | grep picklevibes)"
echo ""
echo "🌐 網站地址: http://$DOMAIN"
echo "🔧 後端 API: http://$DOMAIN/api"
echo ""
echo "📝 有用的命令:"
echo "  - 查看後端日誌: pm2 logs picklevibes"
echo "  - 重啟後端: pm2 restart picklevibes"
echo "  - 查看 Apache 日誌: tail -f /var/log/apache2/picklevibes_error.log"
echo "  - 重啟 Apache: systemctl restart apache2"

