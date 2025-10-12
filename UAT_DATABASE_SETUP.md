# UAT 數據庫設置指南

## 概述

本指南說明如何從生產環境匯出數據並設置 UAT 測試數據庫。

## 📦 已匯出的數據

### 匯出位置
```
./db-backups/export_20251012_125858/
└── picklevibes/
    ├── users.bson.gz (50 用戶)
    ├── bookings.bson.gz (7 預約)
    ├── recharges.bson.gz (6 充值記錄)
    ├── courts.bson.gz (3 場地)
    ├── userbalances.bson.gz (21 餘額記錄)
    ├── stripetransactions.bson.gz (32 交易)
    ├── redeemcodes.bson.gz (1 優惠碼)
    └── redeemusages.bson.gz (0 使用記錄)
```

### 壓縮包
```
./db-backups/export_20251012_125858.tar.gz (20K)
```

## 🚀 設置 UAT 數據庫

### 步驟 1: 在 MongoDB Atlas 創建 UAT 數據庫

1. 登入 [MongoDB Atlas](https://cloud.mongodb.com/)
2. 選擇您的項目
3. 點擊 "Browse Collections"
4. 創建新數據庫:
   - Database Name: `picklevibes-uat`
   - Collection Name: `users` (初始集合)

### 步驟 2: 配置網絡訪問

1. 在 MongoDB Atlas 左側選單選擇 "Network Access"
2. 點擊 "Add IP Address"
3. 選項:
   - **開發環境**: 添加您當前的 IP
   - **服務器環境**: 添加 UAT 服務器的 IP
   - **臨時測試**: 選擇 "Allow Access from Anywhere" (0.0.0.0/0)

### 步驟 3: 創建數據庫用戶

1. 在左側選單選擇 "Database Access"
2. 點擊 "Add New Database User"
3. 設置:
   - Username: `uat-user` (或其他名稱)
   - Password: 生成強密碼
   - Database User Privileges: "Read and write to any database"
4. 保存用戶名和密碼

### 步驟 4: 獲取連接字符串

1. 回到 "Databases" 頁面
2. 點擊 "Connect"
3. 選擇 "Connect your application"
4. 複製連接字符串，格式如下:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/picklevibes-uat?retryWrites=true&w=majority
   ```
5. 替換 `<username>` 和 `<password>` 為實際值

## 📥 導入數據到 UAT 數據庫

### 方法 1: 使用提供的導入腳本（推薦）

```bash
./db-backups/export_20251012_125858/import-to-uat.sh 'mongodb+srv://uat-user:password@cluster0.xxxxx.mongodb.net/picklevibes-uat'
```

### 方法 2: 使用 mongorestore 命令

```bash
mongorestore \
  --uri='mongodb+srv://uat-user:password@cluster0.xxxxx.mongodb.net/picklevibes-uat' \
  --gzip \
  --drop \
  ./db-backups/export_20251012_125858/picklevibes
```

**參數說明:**
- `--uri`: UAT 數據庫連接字符串
- `--gzip`: 解壓縮 .gz 文件
- `--drop`: 導入前先刪除現有集合（清空數據庫）
- 最後是包含數據的目錄路徑

### 方法 3: 不使用 --drop 選項（保留現有數據）

如果想保留 UAT 數據庫中的現有數據:

```bash
mongorestore \
  --uri='mongodb+srv://uat-user:password@cluster0.xxxxx.mongodb.net/picklevibes-uat' \
  --gzip \
  ./db-backups/export_20251012_125858/picklevibes
```

## 🧹 準備測試數據

導入完成後，運行數據準備腳本:

```bash
node prepare-uat-data.js 'mongodb+srv://uat-user:password@cluster0.xxxxx.mongodb.net/picklevibes-uat'
```

此腳本會:
1. ✅ 創建測試帳號（管理員、VIP、普通用戶）
2. ✅ 清理 Stripe 敏感數據
3. ✅ 標記所有交易為測試模式
4. ✅ 清理過期預約
5. ✅ 創建測試優惠碼
6. ✅ 顯示測試帳號信息

## 👤 測試帳號

導入並準備數據後，可使用以下測試帳號:

| 角色 | 郵箱 | 密碼 | 積分 | 會員類型 |
|------|------|------|------|---------|
| 管理員 | admin@picklevibes.hk | Test@1234 | - | VIP |
| VIP用戶 | vip@picklevibes.hk | Test@1234 | 5000 | VIP |
| 普通用戶 | user@picklevibes.hk | Test@1234 | 1000 | Basic |

## 🎟️ 測試優惠碼

- **優惠碼**: `UAT2025`
- **類型**: 百分比折扣
- **折扣**: 20% (8折)
- **使用限制**: 100次
- **有效期**: 1年

## ⚙️ 更新環境配置

### 後端配置 (.env.uat)

創建或更新 `.env.uat` 文件:

```env
# MongoDB UAT 連接
MONGODB_URI=mongodb+srv://uat-user:password@cluster0.xxxxx.mongodb.net/picklevibes-uat?retryWrites=true&w=majority

# 其他配置保持不變...
NODE_ENV=uat
PORT=5009
JWT_SECRET=your-uat-jwt-secret
```

### 前端配置 (client/.env.uat)

確保前端配置指向 UAT API:

```env
REACT_APP_API_URL=https://api-uat.picklevibes.hk/api
REACT_APP_ENV=uat
```

## ✅ 驗證導入

### 1. 使用 MongoDB Compass

1. 下載並安裝 [MongoDB Compass](https://www.mongodb.com/products/compass)
2. 使用 UAT 連接字符串連接
3. 瀏覽 `picklevibes-uat` 數據庫
4. 檢查各集合的文檔數量

### 2. 使用 mongo shell

```bash
mongo "mongodb+srv://cluster0.xxxxx.mongodb.net/picklevibes-uat" --username uat-user

# 連接後執行
use picklevibes-uat
show collections
db.users.count()
db.bookings.count()
db.courts.count()
```

### 3. 使用 Node.js 腳本

```javascript
// check-uat-db.js
const mongoose = require('mongoose');

const uatUri = 'mongodb+srv://uat-user:password@cluster0.xxxxx.mongodb.net/picklevibes-uat';

mongoose.connect(uatUri).then(async () => {
  console.log('✅ 連接成功');
  
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('\n📊 集合列表:');
  
  for (const col of collections) {
    const count = await mongoose.connection.db.collection(col.name).countDocuments();
    console.log(`  - ${col.name}: ${count} 文檔`);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('❌ 連接失敗:', err);
});
```

運行: `node check-uat-db.js`

## 🔄 定期更新 UAT 數據

### 從生產環境同步數據

```bash
# 1. 匯出生產數據
./export-db-to-uat.sh

# 2. 導入到 UAT
./db-backups/export_YYYYMMDD_HHMMSS/import-to-uat.sh '<UAT_URI>'

# 3. 準備測試數據
node prepare-uat-data.js '<UAT_URI>'
```

### 建議同步頻率

- **每週**: 同步場地和優惠碼配置
- **每月**: 完整同步所有數據
- **需求時**: 測試新功能前同步最新數據

## 🔐 安全注意事項

1. **不要在 UAT 使用生產環境的 Stripe 金鑰**
   - 始終使用 `sk_test_` 和 `pk_test_` 開頭的測試金鑰

2. **保護數據庫憑證**
   - 不要將 `.env.uat` 提交到 Git
   - 使用強密碼
   - 定期更換數據庫密碼

3. **網絡訪問限制**
   - 只允許必要的 IP 訪問 UAT 數據庫
   - 避免使用 "Allow Access from Anywhere"

4. **敏感數據處理**
   - UAT 環境不應包含真實用戶數據
   - 如導入生產數據，應匿名化處理

## 🧪 測試場景

導入數據後，可測試以下場景:

### 用戶功能
- ✅ 使用測試帳號登入
- ✅ 查看和更新個人資料
- ✅ 充值積分（使用 Stripe 測試卡）
- ✅ 升級 VIP 會員

### 預約功能
- ✅ 查看場地列表
- ✅ 選擇時間段
- ✅ 創建預約
- ✅ 使用積分支付
- ✅ 應用優惠碼 (UAT2025)
- ✅ 查看預約記錄
- ✅ 取消預約

### 管理功能
- ✅ 管理員登入
- ✅ 查看所有預約
- ✅ 管理場地狀態
- ✅ 管理用戶
- ✅ 創建優惠碼
- ✅ 查看統計數據

## 🐛 常見問題

### Q: mongorestore 報錯 "connection refused"?

**A**: 檢查:
1. MongoDB URI 是否正確
2. 網絡訪問白名單是否包含您的 IP
3. 用戶名和密碼是否正確

### Q: 導入後找不到數據?

**A**: 確認:
1. 使用了正確的數據庫名稱 `picklevibes-uat`
2. 導入路徑是否指向 `picklevibes` 目錄
3. 檢查 MongoDB Atlas 的 Collections

### Q: 測試帳號無法登入?

**A**: 
1. 運行 `prepare-uat-data.js` 創建測試帳號
2. 確認密碼: `Test@1234`
3. 檢查後端 JWT_SECRET 配置

### Q: Stripe 支付在 UAT 不工作?

**A**: 
1. 確認使用測試環境金鑰 (`sk_test_` 和 `pk_test_`)
2. 使用 Stripe 測試卡號: `4242 4242 4242 4242`
3. 檢查 webhook 配置

## 📚 相關資源

- [MongoDB Atlas 文檔](https://docs.atlas.mongodb.com/)
- [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/)
- [Stripe 測試模式](https://stripe.com/docs/testing)
- [UAT 部署指南](./UAT_DEPLOYMENT_GUIDE.md)

## 📞 支援

如需協助:
- 技術支援: tech@picklevibes.hk
- DevOps 團隊: devops@picklevibes.hk

---

**最後更新**: 2025-01-12  
**維護者**: Picklevibes DevOps Team

