#!/usr/bin/env bash
# 從 mongodump 還原 UAT 備份到本機 picklevibes-saas-dev
# 用法：./scripts/restore-saas-dev.sh [backup目錄]
# 例：  ./scripts/restore-saas-dev.sh ./backup/uat-20260618

set -euo pipefail

BACKUP_DIR="${1:-./backup/uat-20260618}"
SOURCE_DB="${SOURCE_DB:-picklevibes}"
TARGET_DB="${TARGET_DB:-picklevibes-saas-dev}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017}"

if [[ ! -d "$BACKUP_DIR/$SOURCE_DB" ]]; then
  echo "❌ 找不到 $BACKUP_DIR/$SOURCE_DB"
  echo "   mongorestore 路徑應為包含「$SOURCE_DB」資料夾的上一層，例如 ./backup/uat-20260618"
  exit 1
fi

echo "還原 $SOURCE_DB → $TARGET_DB"
echo "來源：$BACKUP_DIR"
echo "目標：$MONGO_URI"
echo ""

mongorestore \
  --uri="$MONGO_URI" \
  --nsFrom="${SOURCE_DB}.*" \
  --nsTo="${TARGET_DB}.*" \
  --drop \
  "$BACKUP_DIR"

echo ""
echo "✅ 完成。驗證："
echo "   mongosh $MONGO_URI/$TARGET_DB --eval \"db.users.countDocuments()\""
