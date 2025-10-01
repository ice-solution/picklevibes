#!/bin/bash

# 修復前端依賴問題

echo "🔧 修復 client 依賴問題..."

cd client

echo "📦 步驟 1: 刪除舊的依賴..."
rm -rf node_modules package-lock.json

echo "📦 步驟 2: 清除 npm 緩存..."
npm cache clean --force

echo "📦 步驟 3: 重新安裝依賴..."
npm install

echo "✅ 完成！"
echo ""
echo "如果仍有問題，可以嘗試："
echo "  cd client && npm install --legacy-peer-deps"

