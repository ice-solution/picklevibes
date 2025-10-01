#!/bin/bash

# Stripe Webhook 設置腳本

echo "🎯 Stripe Webhook 設置向導"
echo "================================"
echo ""

# 檢查是否為 root
if [ "$EUID" -ne 0 ]; then 
    echo "請使用 sudo 運行此腳本"
    exit 1
fi

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_DIR="/var/www/html/picklevibes"
ENV_FILE="$PROJECT_DIR/.env"

echo -e "${YELLOW}步驟 1: 檢查環境變量文件${NC}"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ .env 文件不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✅ .env 文件存在${NC}"
echo ""

echo -e "${YELLOW}步驟 2: 輸入 Stripe Webhook 密鑰${NC}"
echo "請從 Stripe Dashboard 獲取 Webhook 密鑰"
echo "位置: 開發者 → Webhooks → 您的端點 → 簽名密鑰"
echo ""
read -p "請輸入 Webhook 密鑰 (whsec_...): " WEBHOOK_SECRET

if [[ ! $WEBHOOK_SECRET =~ ^whsec_ ]]; then
    echo -e "${RED}❌ 無效的 Webhook 密鑰（應該以 whsec_ 開頭）${NC}"
    exit 1
fi

echo -e "${YELLOW}步驟 3: 更新環境變量${NC}"
if grep -q "STRIPE_WEBHOOK_SECRET" "$ENV_FILE"; then
    # 更新現有值
    sed -i "s|STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET|g" "$ENV_FILE"
    echo -e "${GREEN}✅ 已更新 STRIPE_WEBHOOK_SECRET${NC}"
else
    # 添加新值
    echo "" >> "$ENV_FILE"
    echo "# Stripe Webhook 密鑰" >> "$ENV_FILE"
    echo "STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET" >> "$ENV_FILE"
    echo -e "${GREEN}✅ 已添加 STRIPE_WEBHOOK_SECRET${NC}"
fi
echo ""

echo -e "${YELLOW}步驟 4: 驗證配置${NC}"
echo "當前環境變量："
grep "STRIPE" "$ENV_FILE"
echo ""

echo -e "${YELLOW}步驟 5: 重啟後端服務${NC}"
cd "$PROJECT_DIR"
pm2 restart picklevibes
echo -e "${GREEN}✅ 後端已重啟${NC}"
echo ""

echo -e "${YELLOW}步驟 6: 測試 Webhook 端點${NC}"
echo "正在測試端點..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://picklevibes.hk/api/payments/webhook -X POST)

if [ "$RESPONSE" -eq 400 ]; then
    echo -e "${GREEN}✅ Webhook 端點可訪問（返回 400 是正常的，因為缺少簽名）${NC}"
elif [ "$RESPONSE" -eq 200 ]; then
    echo -e "${GREEN}✅ Webhook 端點可訪問${NC}"
else
    echo -e "${RED}⚠️  Webhook 端點返回: $RESPONSE${NC}"
    echo "這可能是正常的，請手動測試"
fi
echo ""

echo -e "${GREEN}🎉 設置完成！${NC}"
echo ""
echo "下一步："
echo "1. 前往 Stripe Dashboard: https://dashboard.stripe.com/webhooks"
echo "2. 確認 Webhook 端點已添加："
echo "   URL: https://picklevibes.hk/api/payments/webhook"
echo "3. 事件選擇："
echo "   - payment_intent.succeeded"
echo "   - payment_intent.payment_failed"
echo "   - checkout.session.completed"
echo "4. 點擊「發送測試 webhook」測試"
echo ""
echo "查看日誌: pm2 logs picklevibes"
echo "詳細文檔: cat STRIPE_WEBHOOK_SETUP.md"

