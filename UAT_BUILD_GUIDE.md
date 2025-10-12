# UAT 環境建構指南

## 前端建構使用 UAT 配置

本指南說明如何使用 UAT 環境的配置來建構 React 前端應用。

## 📋 準備工作

### 1. 確認環境配置文件存在

檢查是否有 `.env.uat` 文件：

```bash
cd client
ls -la | grep .env.uat
```

如果沒有，請從範例文件複製並編輯：

```bash
cp env.uat.example .env.uat
nano .env.uat  # 編輯並填入實際的配置值
```

### 2. UAT 環境配置文件內容

`.env.uat` 文件應包含以下配置：

```env
# API 端點 - UAT環境
REACT_APP_API_URL=https://api-uat.picklevibes.hk/api
REACT_APP_SERVER_URL=https://api-uat.picklevibes.hk

# Stripe 可公開金鑰（測試環境）
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_test_key

# Google Analytics
REACT_APP_GA_TRACKING_ID=G-7E971TSS9Q

# 環境標識
REACT_APP_ENV=uat
NODE_ENV=production

# 前端URL
CLIENT_URL=https://uat.picklevibes.hk

# 功能開關
REACT_APP_ENABLE_WHATSAPP=true
REACT_APP_ENABLE_VIP_MEMBERSHIP=true
REACT_APP_ENABLE_REDEEM_CODE=true

# 其他配置
REACT_APP_MAX_BOOKING_DAYS=90
REACT_APP_MIN_BOOKING_HOURS=1
REACT_APP_MAX_PLAYERS=8
```

## 🚀 建構方法

### 方法 1: 使用 npm script（推薦）

我們已經在 `package.json` 中添加了 `build:uat` 命令：

```bash
# 進入前端目錄
cd client

# 使用 UAT 配置建構
npm run build:uat
```

這個命令會：
1. 載入 `.env.uat` 文件中的環境變數
2. 使用生產模式建構（優化代碼）
3. 輸出到 `client/build/` 目錄

### 方法 2: 使用環境變數（手動）

如果不想使用 `env-cmd`，也可以手動設置環境變數：

```bash
cd client

# macOS/Linux
export REACT_APP_API_URL=https://api-uat.picklevibes.hk/api
export REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
export REACT_APP_ENV=uat
npm run build

# Windows (PowerShell)
$env:REACT_APP_API_URL="https://api-uat.picklevibes.hk/api"
$env:REACT_APP_STRIPE_PUBLISHABLE_KEY="pk_test_..."
$env:REACT_APP_ENV="uat"
npm run build
```

### 方法 3: 使用 .env.production.local（替代方案）

Create React App 在建構時會自動載入 `.env.production.local`：

```bash
cd client

# 複製 UAT 配置到 production.local
cp .env.uat .env.production.local

# 建構
npm run build

# 建構完成後刪除（避免混淆）
rm .env.production.local
```

## 📦 建構輸出

建構完成後，產物會在：
```
client/build/
├── index.html
├── static/
│   ├── css/
│   ├── js/
│   └── media/
├── favicon.ico
├── logo192.png
├── logo512.png
├── manifest.json
└── robots.txt
```

## ✅ 驗證建構

### 1. 檢查建構文件

```bash
ls -lh client/build/
```

### 2. 檢查環境變數是否正確注入

建構的 JavaScript 文件會包含環境變數。可以檢查：

```bash
# 檢查 API URL
grep -r "api-uat.picklevibes.hk" client/build/static/js/

# 檢查環境標識
grep -r "REACT_APP_ENV" client/build/static/js/ | head -1
```

### 3. 本地預覽建構結果

```bash
# 安裝 serve（如果尚未安裝）
npm install -g serve

# 在本地運行建構的應用
cd client
serve -s build -p 3000
```

然後訪問 `http://localhost:3000` 預覽。

## 🔄 完整建構流程

### 本地建構並測試

```bash
# 1. 確保在項目根目錄
cd /Users/leungkeith/projects/picklevibes

# 2. 進入前端目錄
cd client

# 3. 安裝依賴（如果需要）
npm install

# 4. 使用 UAT 配置建構
npm run build:uat

# 5. 檢查建構結果
ls -lh build/

# 6. 本地預覽（可選）
serve -s build -p 3000
```

### 部署到 UAT 服務器

```bash
# 1. 建構完成後，壓縮產物
cd client
tar -czf build-uat.tar.gz build/

# 2. 上傳到 UAT 服務器
scp build-uat.tar.gz user@uat-server:/tmp/

# 3. SSH 登入服務器
ssh user@uat-server

# 4. 解壓並部署
cd /var/www/picklevibes-uat/client
rm -rf build
tar -xzf /tmp/build-uat.tar.gz
rm /tmp/build-uat.tar.gz

# 5. 如果使用 Nginx，重啟服務
sudo systemctl reload nginx
```

## 🤖 自動化建構（GitHub Actions）

UAT 環境已配置自動部署。當您推送代碼到 `uat` 分支時，GitHub Actions 會自動：

1. 檢出代碼
2. 安裝依賴
3. 使用 UAT 配置建構前端
4. 部署到 UAT 服務器

查看工作流程文件：`.github/workflows/uat-deploy.yml`

## 📝 不同環境的建構命令

| 環境 | 命令 | 配置文件 |
|------|------|---------|
| 開發 | `npm start` | `.env.local` |
| UAT | `npm run build:uat` | `.env.uat` |
| 生產 | `npm run build:production` | `.env.production` 或環境變數 |

## ⚙️ 環境變數優先級

Create React App 載入環境變數的優先級（從高到低）：

1. Shell 環境變數（如 `export REACT_APP_API_URL=...`）
2. `.env.local`（所有環境，但 test 除外）
3. `.env.development.local`, `.env.test.local`, `.env.production.local`
4. `.env.development`, `.env.test`, `.env.production`
5. `.env`

**注意**：`env-cmd -f .env.uat` 會覆蓋其他配置文件。

## 🐛 常見問題

### Q: 建構後環境變數沒有生效？

**A**: 確認：
1. 環境變數名稱必須以 `REACT_APP_` 開頭
2. 變更 `.env.uat` 後需要重新建構
3. 檢查 `.env.uat` 文件是否存在於 `client/` 目錄

### Q: `env-cmd: command not found`？

**A**: 安裝 env-cmd：
```bash
cd client
npm install --save-dev env-cmd
```

### Q: 建構後 API 請求還是指向 localhost？

**A**: 檢查：
1. `.env.uat` 中的 `REACT_APP_API_URL` 是否正確
2. 確認使用 `npm run build:uat` 而不是 `npm run build`
3. 檢查代碼中是否有硬編碼的 API URL

### Q: 如何在建構時看到使用的環境變數？

**A**: 可以在建構腳本中添加日誌：

修改 `package.json`：
```json
"build:uat": "env-cmd -f .env.uat bash -c 'echo API URL: $REACT_APP_API_URL && react-scripts build'"
```

## 🔒 安全提示

1. **不要提交 `.env.uat`** - 此文件包含敏感信息，應添加到 `.gitignore`
2. **保護 Stripe 金鑰** - 確保使用測試環境的金鑰，不要暴露生產金鑰
3. **檢查建構產物** - 確保沒有意外包含敏感數據

## 📚 相關資源

- [Create React App - 環境變數](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [env-cmd 文檔](https://github.com/toddbluhm/env-cmd)
- [UAT 部署指南](./UAT_DEPLOYMENT_GUIDE.md)

---

**最後更新**: 2025-01-12  
**維護者**: Picklevibes DevOps Team

