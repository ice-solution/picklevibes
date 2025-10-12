#!/bin/bash

# MongoDB 數據匯出到 UAT 環境腳本
# 使用方法: ./export-db-to-uat.sh

set -e  # 遇到錯誤立即退出

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./db-backups"
EXPORT_DIR="$BACKUP_DIR/export_$TIMESTAMP"

# 從 .env 文件讀取配置
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${RED}錯誤: 找不到 .env 文件${NC}"
    exit 1
fi

# 函數：顯示成功訊息
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 函數：顯示信息訊息
info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# 函數：顯示警告訊息
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 函數：顯示錯誤訊息
error() {
    echo -e "${RED}✗ $1${NC}"
}

echo "================================================"
echo "MongoDB 數據匯出工具 - UAT 環境準備"
echo "================================================"
echo ""

# 檢查 MongoDB 工具是否安裝
if ! command -v mongodump &> /dev/null; then
    error "未安裝 mongodump"
    echo ""
    echo "請安裝 MongoDB Database Tools:"
    echo "  macOS: brew install mongodb-database-tools"
    echo "  Ubuntu: sudo apt-get install mongodb-database-tools"
    echo "  或訪問: https://www.mongodb.com/docs/database-tools/installation/installation/"
    exit 1
fi

# 檢查 MongoDB URI
if [ -z "$MONGODB_URI" ]; then
    error "未找到 MONGODB_URI 環境變數"
    exit 1
fi

info "MongoDB URI: ${MONGODB_URI%%@*}@***"

# 創建備份目錄
mkdir -p "$EXPORT_DIR"
success "創建匯出目錄: $EXPORT_DIR"

# 匯出數據
echo ""
info "開始匯出數據庫..."
echo ""

mongodump \
    --uri="$MONGODB_URI" \
    --out="$EXPORT_DIR" \
    --gzip

if [ $? -eq 0 ]; then
    success "數據匯出成功！"
else
    error "數據匯出失敗"
    exit 1
fi

# 顯示匯出統計
echo ""
info "匯出統計:"
echo ""

# 計算大小
TOTAL_SIZE=$(du -sh "$EXPORT_DIR" | cut -f1)
echo "  總大小: $TOTAL_SIZE"

# 計算文件數量
FILE_COUNT=$(find "$EXPORT_DIR" -type f -name "*.bson.gz" | wc -l | tr -d ' ')
echo "  集合數量: $FILE_COUNT"

# 列出所有匯出的集合
echo ""
info "已匯出的集合:"
find "$EXPORT_DIR" -name "*.bson.gz" | while read file; do
    collection=$(basename "$file" .bson.gz)
    size=$(du -h "$file" | cut -f1)
    echo "  - $collection ($size)"
done

# 創建匯出說明文件
cat > "$EXPORT_DIR/README.txt" << EOF
MongoDB 數據匯出
================

匯出時間: $(date)
源數據庫: picklevibes (生產環境)
目標用途: UAT 環境數據

匯出內容:
- 所有集合和文檔
- 包含索引定義
- 使用 gzip 壓縮

如何導入到 UAT 環境:
=====================

1. 確保有 UAT 數據庫的連接字符串
2. 運行以下命令:

   mongorestore \\
     --uri="mongodb+srv://user:pass@cluster.mongodb.net/picklevibes-uat" \\
     --gzip \\
     --drop \\
     $EXPORT_DIR/picklevibes

選項說明:
- --uri: UAT 數據庫連接字符串
- --gzip: 解壓縮數據
- --drop: 導入前先刪除現有集合（可選）

注意事項:
=========
- 導入前請備份 UAT 數據庫
- 確認 UAT 環境的連接字符串正確
- 導入後請更新測試用戶的密碼
- 檢查並更新環境特定的配置

EOF

success "創建說明文件"

# 創建壓縮包
echo ""
info "創建壓縮包..."
cd "$BACKUP_DIR"
tar -czf "export_$TIMESTAMP.tar.gz" "export_$TIMESTAMP"
ARCHIVE_SIZE=$(du -h "export_$TIMESTAMP.tar.gz" | cut -f1)
success "壓縮包創建完成: export_$TIMESTAMP.tar.gz ($ARCHIVE_SIZE)"
cd - > /dev/null

# 創建導入腳本
IMPORT_SCRIPT="$EXPORT_DIR/import-to-uat.sh"
cat > "$IMPORT_SCRIPT" << 'EOF'
#!/bin/bash

# UAT 數據庫導入腳本
# 使用方法: ./import-to-uat.sh <UAT_MONGODB_URI>

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}錯誤: 請提供 UAT MongoDB URI${NC}"
    echo "使用方法: $0 <UAT_MONGODB_URI>"
    echo "範例: $0 'mongodb+srv://user:pass@cluster.mongodb.net/picklevibes-uat'"
    exit 1
fi

UAT_URI="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}警告: 此操作將覆蓋 UAT 數據庫中的所有數據${NC}"
echo "UAT URI: ${UAT_URI%%@*}@***"
echo ""
read -p "確定要繼續嗎? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo "開始導入數據..."

mongorestore \
    --uri="$UAT_URI" \
    --gzip \
    --drop \
    "$SCRIPT_DIR/picklevibes"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 數據導入成功！${NC}"
    echo ""
    echo "後續步驟:"
    echo "1. 更新測試用戶密碼"
    echo "2. 檢查數據一致性"
    echo "3. 測試應用功能"
else
    echo -e "${RED}✗ 數據導入失敗${NC}"
    exit 1
fi
EOF

chmod +x "$IMPORT_SCRIPT"
success "創建導入腳本: $IMPORT_SCRIPT"

# 最終總結
echo ""
echo "================================================"
success "數據匯出完成！"
echo "================================================"
echo ""
echo "📁 匯出位置:"
echo "   目錄: $EXPORT_DIR"
echo "   壓縮包: $BACKUP_DIR/export_$TIMESTAMP.tar.gz"
echo ""
echo "📋 下一步操作:"
echo ""
echo "1️⃣  查看匯出內容:"
echo "   cd $EXPORT_DIR"
echo "   ls -lh"
echo ""
echo "2️⃣  導入到 UAT 數據庫:"
echo "   $IMPORT_SCRIPT 'mongodb+srv://user:pass@cluster.mongodb.net/picklevibes-uat'"
echo ""
echo "3️⃣  或使用 mongorestore 手動導入:"
echo "   mongorestore \\"
echo "     --uri='mongodb+srv://user:pass@cluster.mongodb.net/picklevibes-uat' \\"
echo "     --gzip \\"
echo "     --drop \\"
echo "     $EXPORT_DIR/picklevibes"
echo ""
echo "4️⃣  傳輸壓縮包到其他機器:"
echo "   scp $BACKUP_DIR/export_$TIMESTAMP.tar.gz user@server:/path/"
echo ""
echo "⚠️  重要提醒:"
echo "   - 導入前請先備份 UAT 數據庫"
echo "   - 導入後更新測試用戶密碼"
echo "   - 檢查環境特定的配置"
echo ""

