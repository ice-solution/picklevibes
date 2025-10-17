#!/bin/bash

# 檢查 Git 狀態的腳本
echo "🔍 檢查 Git 狀態..."
echo "================================"

echo "📊 Git 狀態："
git status --short

echo ""
echo "📝 工作區更改："
git diff --name-only

echo ""
echo "📦 暫存區更改："
git diff --cached --name-only

echo ""
echo "🔍 檢查特定文件："
if [ -f "server/index.js" ]; then
    echo "server/index.js 存在"
    if git diff server/index.js > /dev/null 2>&1; then
        echo "✅ server/index.js 沒有未提交的更改"
    else
        echo "⚠️  server/index.js 有未提交的更改"
        echo "更改內容："
        git diff server/index.js
    fi
else
    echo "❌ server/index.js 不存在"
fi

echo ""
echo "================================"
echo "✅ 檢查完成"
