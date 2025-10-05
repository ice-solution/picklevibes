#!/bin/bash

# 重啟服務腳本

echo "🔄 重啟 PickleVibes 服務..."

PROJECT_DIR="/var/www/html/picklevibes"

# 檢查 PM2
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 未安裝"
    exit 1
fi

echo "📦 步驟 1: 重啟後端服務"
pm2 restart picklevibes

echo "⏳ 等待服務啟動..."
sleep 3

echo "📊 步驟 2: 檢查服務狀態"
pm2 status

echo ""
echo "📋 步驟 3: 查看最新日誌"
pm2 logs picklevibes --lines 20 --nostream

echo ""
echo "✅ 服務已重啟！"
echo ""
echo "測試 Webhook:"
echo "curl -X POST https://picklevibes.hk/api/payments/webhook"
echo ""
echo "查看實時日誌:"
echo "pm2 logs picklevibes"

