# 前端構建指南

## 📋 前端環境變量配置

React 在構建時會使用不同的環境變量文件：

### 開發環境
- 文件: `client/.env.local` 或 `client/.env.development`
- 使用時機: `npm start`
- API URL: `http://localhost:5001/api`

### 生產環境
- 文件: `client/.env.production`
- 使用時機: `npm run build`
- API URL: `/api` (相對路徑，通過 Apache 代理)

## 🔧 設置生產環境變量

### 步驟 1: 創建 `.env.production` 文件

在服務器上執行：
```bash
cd /var/www/html/picklevibes/client
nano .env.production
```

### 步驟 2: 添加以下內容

```env
# API 配置 - 使用相對路徑
REACT_APP_API_URL=/api
REACT_APP_SERVER_URL=

# Stripe 配置 - 使用生產環境密鑰
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_51SClx42M0ztdyPwLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 環境標識
REACT_APP_NODE_ENV=production
```

### 步驟 3: 構建前端

```bash
cd /var/www/html/picklevibes/client
npm install
npm run build
```

## 🔑 重要說明

### 1. **API URL 配置**

生產環境使用 **相對路徑** `/api`：
- ✅ 正確: `REACT_APP_API_URL=/api`
- ❌ 錯誤: `REACT_APP_API_URL=http://picklevibes.hk/api`
- ❌ 錯誤: `REACT_APP_API_URL=http://localhost:5001/api`

**為什麼？**
- Apache 配置了 `ProxyPass /api http://localhost:5001/api`
- 前端請求 `/api` 會自動轉發到後端
- 避免 CORS 問題
- 支持 HTTP 和 HTTPS

### 2. **Stripe 密鑰**

⚠️ **重要**: 必須使用生產環境密鑰！

| 環境 | 密鑰前綴 | 用途 |
|------|---------|------|
| 測試 | `pk_test_` | 開發和測試 |
| 生產 | `pk_live_` | 正式環境 ✅ |

獲取生產密鑰：
1. 訪問 [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. 切換到 **生產模式**（Production）
3. 複製 **Publishable key** (pk_live_...)

### 3. **環境變量優先級**

React 會按以下順序讀取環境變量：

1. `npm run build` 構建時:
   - `.env.production.local` (最高優先級，git ignored)
   - `.env.production`
   - `.env.local` (git ignored)
   - `.env`

2. `npm start` 開發時:
   - `.env.development.local` (最高優先級，git ignored)
   - `.env.development`
   - `.env.local` (git ignored)
   - `.env`

## 📁 文件結構

```
client/
├── .env.production          ← 生產環境配置（手動創建）
├── .env.local              ← 開發環境配置（手動創建）
├── env.example             ← 配置範例（已提交到 git）
├── env.production.example  ← 生產環境範例（已提交到 git）
└── .gitignore              ← 忽略所有 .env* 文件
```

## 🚀 完整部署流程

### 本地構建（測試用）

```bash
# 1. 創建生產環境配置
cd client
cp env.production.example .env.production
nano .env.production  # 編輯並填入實際值

# 2. 構建
npm run build

# 3. 檢查構建結果
ls -la build/
```

### 服務器構建（推薦）

```bash
# 1. 上傳代碼到服務器（不包含 .env 文件）
git push origin main

# 2. SSH 連接到服務器
ssh root@your-server

# 3. 拉取最新代碼
cd /var/www/html/picklevibes
git pull origin main

# 4. 創建生產環境配置
cd client
nano .env.production
# 粘貼上面的配置內容

# 5. 構建
npm install
npm run build

# 6. 檢查構建結果
ls -la build/
cat build/static/js/main.*.js | grep -o "REACT_APP_API_URL" || echo "環境變量已正確編譯"
```

## 🔍 驗證環境變量

### 方法 1: 檢查構建文件

```bash
# 搜索 API URL（不應該找到，因為已編譯）
grep -r "localhost:5001" client/build/

# 搜索測試密鑰（不應該找到）
grep -r "pk_test_" client/build/

# 如果找到任何結果，說明環境變量沒有正確設置！
```

### 方法 2: 瀏覽器檢查

1. 打開瀏覽器開發者工具 (F12)
2. Network 標籤
3. 發起 API 請求
4. 檢查請求 URL：
   - ✅ 正確: `https://picklevibes.hk/api/courts`
   - ❌ 錯誤: `http://localhost:5001/api/courts`

### 方法 3: 測試 Stripe

1. 嘗試創建預約並支付
2. 應該跳轉到 Stripe 生產環境頁面
3. 檢查 URL 是否包含測試標識：
   - ✅ 正確: 沒有 "test" 字樣
   - ❌ 錯誤: URL 包含 "test" 或使用測試卡號

## ⚠️ 常見問題

### 問題 1: API 請求到 localhost

**症狀**: 生產環境仍然請求 `http://localhost:5001/api`

**原因**: `.env.production` 文件不存在或未生效

**解決**:
```bash
cd /var/www/html/picklevibes/client
rm -rf build node_modules
npm install
# 確保 .env.production 存在
cat .env.production
npm run build
```

### 問題 2: Stripe 使用測試密鑰

**症狀**: 支付頁面顯示測試模式

**原因**: `.env.production` 中使用了 `pk_test_` 密鑰

**解決**:
1. 登入 Stripe Dashboard
2. 切換到生產模式
3. 複製正確的 `pk_live_` 密鑰
4. 更新 `.env.production`
5. 重新構建

### 問題 3: 環境變量未更新

**症狀**: 修改 `.env.production` 後沒有效果

**原因**: 需要重新構建

**解決**:
```bash
cd /var/www/html/picklevibes/client
rm -rf build
npm run build
```

## 📝 快速參考

### 生產環境 `.env.production` 模板

```env
# API - 使用相對路徑
REACT_APP_API_URL=/api
REACT_APP_SERVER_URL=

# Stripe - 生產密鑰
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY_HERE

# 環境
REACT_APP_NODE_ENV=production
```

### 開發環境 `.env.local` 模板

```env
# API - 本地後端
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_SERVER_URL=http://localhost:5001

# Stripe - 測試密鑰
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE

# 環境
REACT_APP_NODE_ENV=development
```

## 🔒 安全提醒

1. ⚠️ **永遠不要** 將 `.env.production` 提交到 Git
2. ⚠️ **永遠不要** 在前端使用 Stripe Secret Key (sk_*)
3. ⚠️ **只使用** Publishable Key (pk_*) 在前端
4. ⚠️ **定期更換** 生產環境密鑰
5. ⚠️ **測試完畢** 後才切換到生產密鑰

## 📞 需要幫助？

如果遇到問題：
1. 檢查 `.env.production` 文件是否存在
2. 檢查環境變量語法是否正確
3. 確保使用了 `npm run build` 而不是 `npm start`
4. 清除構建緩存後重試
5. 查看瀏覽器控制台的錯誤信息

