# 環境配置指南

## 🎯 環境判斷

### Create React App 自動判斷環境

| 命令 | NODE_ENV | 使用的環境文件 |
|------|----------|--------------|
| `npm start` | `development` | `.env.development.local` → `.env.local` → `.env.development` → `.env` |
| `npm run build` | `production` | `.env.production.local` → `.env.local` → `.env.production` → `.env` |
| `npm test` | `test` | `.env.test.local` → `.env.test` → `.env` |

**注意**: `.env.local` 在 test 環境中不會被讀取！

## 📁 建議的文件結構

```
client/
├── .env                        # 所有環境的默認值（提交到 git）
├── .env.local                  # 本地開發覆蓋（git ignored）
├── .env.development            # 開發環境默認值（提交到 git）
├── .env.development.local      # 開發環境本地覆蓋（git ignored）
├── .env.production             # 生產環境配置（git ignored）
└── env.production.example      # 生產環境範例（提交到 git）
```

## 🔧 配置文件內容

### .env (所有環境的默認值)
```env
# 應用名稱
REACT_APP_NAME=PickleVibes

# 默認語言
REACT_APP_DEFAULT_LANGUAGE=zh-TW
```

### .env.development (開發環境)
```env
# API 配置 - 本地後端
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_SERVER_URL=http://localhost:5001

# Stripe - 測試密鑰
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_51SClx42M0ztdyPwLh2UAtAZZRjUR9PFvZ2jEH99PNm9PHnhYL0IHTcbzPXpZEjcpH24AC4KUABuqtkBPBwtsFGjj00I8jFiizR

# 環境標識
REACT_APP_NODE_ENV=development

# 調試模式
REACT_APP_DEBUG=true
```

### .env.production (生產環境)
```env
# API 配置 - 相對路徑
REACT_APP_API_URL=/api
REACT_APP_SERVER_URL=

# Stripe - 生產密鑰
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY_HERE

# 環境標識
REACT_APP_NODE_ENV=production

# 調試模式
REACT_APP_DEBUG=false
```

## 💻 在代碼中使用

### 1. 訪問環境變量

```typescript
// 獲取 API URL
const apiUrl = process.env.REACT_APP_API_URL;

// 獲取 Stripe Key
const stripeKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;

// 檢查環境
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
```

### 2. 根據環境執行不同邏輯

```typescript
// src/config/api.ts
const config = {
  development: {
    API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
    DEBUG: true
  },
  production: {
    API_BASE_URL: process.env.REACT_APP_API_URL || '/api',
    DEBUG: false
  }
};

const env = process.env.NODE_ENV || 'development';
export default config[env];
```

### 3. 條件調試

```typescript
// 只在開發環境打印日誌
if (process.env.NODE_ENV === 'development') {
  console.log('API Response:', data);
}

// 或使用自定義調試標誌
if (process.env.REACT_APP_DEBUG === 'true') {
  console.log('Debug info:', info);
}
```

## 🔍 驗證環境配置

### 方法 1: 在代碼中打印

在 `src/index.tsx` 開頭添加：

```typescript
console.log('🔧 Environment:', process.env.NODE_ENV);
console.log('🌐 API URL:', process.env.REACT_APP_API_URL);
console.log('💳 Stripe Key:', process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY?.substring(0, 20) + '...');
```

### 方法 2: 創建環境指示器組件

```typescript
// src/components/EnvIndicator.tsx
const EnvIndicator: React.FC = () => {
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      background: 'red',
      color: 'white',
      padding: '5px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: 9999
    }}>
      🔧 DEV MODE
    </div>
  );
};

export default EnvIndicator;
```

### 方法 3: 檢查構建文件

```bash
# 構建後檢查
npm run build

# 搜索是否包含開發環境的 URL
grep -r "localhost:5001" build/

# 搜索是否包含測試密鑰
grep -r "pk_test_" build/

# 如果找到任何結果，說明環境配置有問題！
```

## ⚠️ 重要注意事項

### 1. 環境變量必須以 `REACT_APP_` 開頭

```typescript
// ✅ 正確 - 會被編譯進代碼
REACT_APP_API_URL=http://localhost:5001

// ❌ 錯誤 - 不會被編譯，訪問時為 undefined
API_URL=http://localhost:5001
```

### 2. 環境變量在構建時被固定

```typescript
// 構建時，環境變量會被替換為實際值
// 構建後無法更改！

// 構建前
const url = process.env.REACT_APP_API_URL;

// 構建後（實際編譯的代碼）
const url = "/api";
```

### 3. 不要在環境變量中存放敏感信息

```env
# ❌ 危險 - 前端代碼所有人都能看到
REACT_APP_SECRET_KEY=super_secret_password

# ✅ 安全 - Stripe Publishable Key 本來就是公開的
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### 4. 修改環境變量後需要重啟

```bash
# 修改 .env 文件後
# 必須重啟開發服務器
Ctrl+C
npm start

# 或重新構建
npm run build
```

## 🚀 部署檢查清單

### 本地開發
```bash
cd client

# 1. 確保有開發環境配置
ls -la .env.development

# 2. 啟動開發服務器
npm start

# 3. 打開瀏覽器檢查
# - 查看 Console 日誌
# - 檢查 Network 請求 URL
# - 應該看到 localhost:5001
```

### 生產構建
```bash
cd client

# 1. 創建生產環境配置
cp env.production.example .env.production
nano .env.production

# 2. 構建
npm run build

# 3. 驗證構建
# 不應該找到開發環境的配置
grep -r "localhost" build/ || echo "✅ Clean"
grep -r "pk_test_" build/ || echo "✅ Clean"

# 4. 檢查構建文件
ls -lh build/static/js/main.*.js
```

### 服務器部署
```bash
# 在服務器上
cd /var/www/html/picklevibes/client

# 1. 確保有生產環境配置
cat .env.production

# 2. 確認內容正確
# API_URL 應該是 /api
# Stripe Key 應該是 pk_live_

# 3. 構建
npm install
npm run build

# 4. 驗證
ls -la build/
```

## 🐛 常見問題

### 問題 1: 環境變量為 undefined

**原因**: 
- 變量名沒有 `REACT_APP_` 前綴
- `.env` 文件格式錯誤
- 沒有重啟開發服務器

**解決**:
```bash
# 檢查文件格式
cat .env.development

# 重啟
npm start
```

### 問題 2: 生產環境仍使用開發配置

**原因**: 
- `.env.production` 不存在
- `.env.local` 覆蓋了生產配置

**解決**:
```bash
# 刪除可能衝突的文件
rm .env.local

# 確保生產配置存在
cat .env.production

# 重新構建
rm -rf build
npm run build
```

### 問題 3: 構建後環境變量改變無效

**原因**: 環境變量在構建時被固定了

**解決**: 必須重新構建
```bash
rm -rf build
npm run build
```

## 📚 參考資料

- [Create React App - 環境變量](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [dotenv 文檔](https://github.com/motdotla/dotenv)

## ✅ 快速參考

| 需求 | 命令 | 環境文件 |
|------|------|---------|
| 本地開發 | `npm start` | `.env.development` |
| 生產構建 | `npm run build` | `.env.production` |
| 檢查環境 | `console.log(process.env.NODE_ENV)` | - |
| 訪問變量 | `process.env.REACT_APP_XXX` | - |

