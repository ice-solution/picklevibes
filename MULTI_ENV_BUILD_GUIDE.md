# 多環境建構指南

## 概述

本指南說明如何在本地機器上建構不同環境的前端版本，避免在生產服務器上建構導致資源耗盡和當機。

## 為什麼要在本地建構？

### 問題
- 🔴 生產服務器資源有限，建構時會佔用大量 CPU 和內存
- 🔴 建構過程可能導致服務器當機或變慢
- 🔴 影響正在運行的應用和用戶體驗

### 解決方案
- ✅ 在本地機器或CI/CD服務器上建構
- ✅ 建構完成後只上傳靜態文件
- ✅ 生產服務器只需要部署，不需要建構

## 📋 支援的環境

| 環境 | 用途 | API URL 範例 |
|------|------|-------------|
| **Development** | 本地開發 | `http://localhost:5001/api` |
| **UAT** | 用戶驗收測試 | `https://api-uat.picklevibes.hk/api` |
| **Staging** | 預發布環境 | `https://api-staging.picklevibes.hk/api` |
| **Production** | 生產環境 | `https://api.picklevibes.hk/api` |

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd client
npm install
```

### 2. 創建環境配置文件

為每個環境創建配置文件：

```bash
# 開發環境
cp env.development.example .env.development

# UAT環境
cp env.uat.example .env.uat

# Staging環境
cp env.staging.example .env.staging

# 生產環境
cp env.production.example .env.production
```

### 3. 編輯配置文件

編輯每個 `.env.*` 文件，填入實際的配置值：

```env
# .env.production 範例
REACT_APP_API_URL=https://api.picklevibes.hk/api
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
REACT_APP_ENV=production
```

### 4. 建構特定環境

```bash
cd client

# 建構開發環境
npm run build:dev

# 建構 UAT 環境
npm run build:uat

# 建構 Staging 環境
npm run build:staging

# 建構生產環境
npm run build:production
```

## 🛠️ 使用建構腳本（推薦）

我們提供了一個便利的腳本來管理多環境建構：

### 基本用法

```bash
# 建構單一環境
./build-all-envs.sh uat

# 建構生產環境
./build-all-envs.sh production

# 建構所有環境
./build-all-envs.sh all
```

### 腳本功能

- ✅ 自動檢查環境配置文件
- ✅ 顯示 API URL 等關鍵配置
- ✅ 計算建構大小
- ✅ 自動保存和壓縮建構產物
- ✅ 生成時間戳標記的版本

### 輸出結構

建構完成後會在 `builds/` 目錄生成：

```
builds/
├── build-uat-20251012_130000/          # UAT 建構目錄
├── build-uat-20251012_130000.tar.gz    # UAT 壓縮包
├── build-production-20251012_130000/   # 生產建構目錄
└── build-production-20251012_130000.tar.gz  # 生產壓縮包
```

## 📝 詳細步驟

### 步驟 1: 準備環境配置

#### Development (.env.development)

```env
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_SERVER_URL=http://localhost:5001
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
REACT_APP_ENV=development
NODE_ENV=development
CLIENT_URL=http://localhost:3000
GENERATE_SOURCEMAP=true
```

#### UAT (.env.uat)

```env
REACT_APP_API_URL=https://api-uat.picklevibes.hk/api
REACT_APP_SERVER_URL=https://api-uat.picklevibes.hk
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
REACT_APP_ENV=uat
NODE_ENV=production
CLIENT_URL=https://uat.picklevibes.hk
GENERATE_SOURCEMAP=false
```

#### Production (.env.production)

```env
REACT_APP_API_URL=https://api.picklevibes.hk/api
REACT_APP_SERVER_URL=https://api.picklevibes.hk
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
REACT_APP_ENV=production
NODE_ENV=production
CLIENT_URL=https://picklevibes.hk
GENERATE_SOURCEMAP=false
INLINE_RUNTIME_CHUNK=false
```

### 步驟 2: 執行建構

#### 方法 A: 使用 npm 命令

```bash
cd client

# 建構特定環境
npm run build:production

# 建構產物在 client/build/
ls -lh build/
```

#### 方法 B: 使用建構腳本

```bash
# 從項目根目錄執行
./build-all-envs.sh production

# 建構產物在 builds/
ls -lh builds/
```

### 步驟 3: 驗證建構

```bash
# 檢查環境變數是否正確注入
grep -r "api.picklevibes.hk" client/build/static/js/

# 檢查建構大小
du -sh client/build/

# 本地預覽
cd client
npx serve -s build -p 3000
```

### 步驟 4: 上傳到服務器

#### 使用 SCP

```bash
# 上傳壓縮包
scp builds/build-production-*.tar.gz user@server:/tmp/

# SSH 登入服務器
ssh user@server

# 在服務器上解壓
cd /tmp
tar -xzf build-production-*.tar.gz

# 備份舊版本
cd /var/www/picklevibes
mv build build.backup.$(date +%Y%m%d_%H%M%S)

# 部署新版本
mv /tmp/build-production-*/ /var/www/picklevibes/build

# 重啟服務（如使用 Nginx）
sudo systemctl reload nginx
```

#### 使用 rsync

```bash
# 同步建構目錄
rsync -avz --delete \
  client/build/ \
  user@server:/var/www/picklevibes/build/
```

## 🔄 完整工作流程

### 開發流程

```bash
# 1. 本地開發
cd client
npm start

# 2. 測試功能
# ...

# 3. 提交代碼
git add .
git commit -m "feat: 新功能"
git push

# 4. 建構 UAT 版本
npm run build:uat

# 5. 上傳到 UAT 服務器測試
scp -r build/ user@uat-server:/var/www/app/

# 6. UAT 測試通過後建構生產版本
npm run build:production

# 7. 上傳到生產服務器
scp -r build/ user@prod-server:/var/www/app/
```

### 使用腳本的流程

```bash
# 1. 建構 UAT 版本
./build-all-envs.sh uat

# 2. 上傳到 UAT 服務器
scp builds/build-uat-*.tar.gz user@uat-server:/tmp/

# 3. 在 UAT 服務器部署
ssh user@uat-server
cd /tmp && tar -xzf build-uat-*.tar.gz
mv build-uat-*/ /var/www/app/build

# 4. UAT 測試通過後，建構生產版本
./build-all-envs.sh production

# 5. 上傳到生產服務器
scp builds/build-production-*.tar.gz user@prod-server:/tmp/

# 6. 在生產服務器部署
ssh user@prod-server
cd /tmp && tar -xzf build-production-*.tar.gz
mv build-production-*/ /var/www/app/build
sudo systemctl reload nginx
```

## 📊 環境變數對照表

| 變數名稱 | Development | UAT | Production |
|---------|-------------|-----|------------|
| REACT_APP_API_URL | localhost:5001 | api-uat.picklevibes.hk | api.picklevibes.hk |
| REACT_APP_STRIPE_KEY | pk_test_... | pk_test_... | pk_live_... |
| REACT_APP_ENV | development | uat | production |
| NODE_ENV | development | production | production |
| GENERATE_SOURCEMAP | true | false | false |

## 🔍 驗證檢查清單

建構完成後，請驗證：

- [ ] 建構成功完成，無錯誤
- [ ] 建構大小合理（通常 1-5MB）
- [ ] API URL 正確注入
- [ ] Stripe 金鑰正確（測試/生產）
- [ ] 環境標識正確
- [ ] 本地預覽正常運行
- [ ] 所有功能正常工作

## 🚨 常見問題

### Q: 建構時出現 "heap out of memory" 錯誤？

**A**: 增加 Node.js 內存限制：

```bash
# 在 package.json 中修改建構命令
"build:production": "NODE_OPTIONS='--max-old-space-size=4096' env-cmd -f .env.production react-scripts build"
```

### Q: 環境變數沒有生效？

**A**: 檢查：
1. 變數名稱必須以 `REACT_APP_` 開頭
2. `.env.*` 文件在正確的位置（`client/` 目錄）
3. 重新建構（修改配置後必須重新建構）

### Q: 建構後 API 請求還是 404？

**A**: 
1. 檢查 `.env.*` 文件中的 `REACT_APP_API_URL`
2. 確認後端 API 正在運行
3. 檢查 CORS 設置

### Q: 如何減小建構大小？

**A**: 
1. 設置 `GENERATE_SOURCEMAP=false`
2. 設置 `INLINE_RUNTIME_CHUNK=false`
3. 移除不必要的依賴
4. 使用代碼分割和懶加載

## 💡 最佳實踐

### 1. 使用 CI/CD 自動化

在 GitHub Actions 中自動建構：

```yaml
# .github/workflows/build-production.yml
name: Build Production

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: cd client && npm ci
      - name: Build production
        run: cd client && npm run build:production
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: production-build
          path: client/build
```

### 2. 版本控制

在建構產物中包含版本信息：

```env
# .env.production
REACT_APP_VERSION=$npm_package_version
REACT_APP_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

### 3. 建構快取

使用 npm cache 加速建構：

```bash
# 在 CI/CD 中
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### 4. 定期清理

```bash
# 清理舊的建構產物
rm -rf builds/build-*-$(date -d '7 days ago' +%Y%m%d)*
```

## 📚 相關資源

- [Create React App - 環境變數](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [env-cmd 文檔](https://github.com/toddbluhm/env-cmd)
- [React 生產優化](https://reactjs.org/docs/optimizing-performance.html)

---

**最後更新**: 2025-01-12  
**維護者**: Picklevibes DevOps Team

