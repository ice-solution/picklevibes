#!/bin/bash

# 測試 Stripe Webhook

echo "🧪 測試 Stripe Webhook"
echo "====================="
echo ""

WEBHOOK_URL="https://picklevibes.hk/api/payments/webhook"

echo "📍 Webhook URL: $WEBHOOK_URL"
echo ""

echo "測試 1: 檢查端點是否可訪問"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $WEBHOOK_URL)
echo "HTTP 狀態碼: $HTTP_CODE"

if [ "$HTTP_CODE" -eq 400 ]; then
    echo "✅ 端點可訪問（400 是預期的，因為缺少簽名）"
elif [ "$HTTP_CODE" -eq 500 ]; then
    echo "⚠️  服務器錯誤，請檢查日誌"
    echo "運行: pm2 logs picklevibes"
else
    echo "ℹ️  HTTP 狀態碼: $HTTP_CODE"
fi

echo ""
echo "測試 2: 檢查後端日誌"
echo "最新日誌（最後 10 行）："
echo "---"
pm2 logs picklevibes --lines 10 --nostream
echo "---"

echo ""
echo "下一步："
echo "1. 前往 Stripe Dashboard: https://dashboard.stripe.com/webhooks"
echo "2. 點擊您的 webhook 端點"
echo "3. 點擊「發送測試 webhook」"
echo "4. 選擇事件類型: payment_intent.succeeded"
echo "5. 應該看到 ✅ 成功（HTTP 200）"
echo ""
echo "實時監控日誌:"
echo "pm2 logs picklevibes --lines 50"

