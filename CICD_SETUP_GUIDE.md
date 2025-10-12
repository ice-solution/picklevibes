# CI/CD 設置指南

## 概述

本指南說明如何為 Picklevibes 項目設置完整的 CI/CD（持續集成/持續部署）流程。

## 🎯 CI/CD 流程架構

```
開發者推送代碼
    ↓
GitHub Actions 觸發
    ↓
┌─────────────────────────────────────┐
│  Stage 1: 測試和驗證                │
│  - Linting                          │
│  - Unit Tests (可選)                │
│  - 代碼質量檢查                      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Stage 2: 建構                       │
│  - 在 GitHub 服務器上建構前端        │
│  - 使用環境特定的配置                │
│  - 生成建構產物 (artifact)           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Stage 3: 部署                       │
│  - 下載建構產物                      │
│  - 上傳到目標服務器                  │
│  - 備份舊版本                        │
│  - 部署新版本                        │
│  - 重啟應用                          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Stage 4: 驗證和通知                 │
│  - 健康檢查                          │
│  - 發送通知（Slack/Email）           │
└─────────────────────────────────────┘
```

## 📋 已創建的 Workflows

### 1. Production Workflow
**文件**: `.github/workflows/ci-cd-production.yml`
**觸發**: 推送到 `main` 分支
**部署到**: 生產環境

### 2. UAT Workflow
**文件**: `.github/workflows/ci-cd-uat.yml`
**觸發**: 推送到 `uat` 分支
**部署到**: UAT 測試環境

## 🔧 設置步驟

### 步驟 1: 配置 GitHub Secrets

訪問：`https://github.com/ice-solution/picklevibes/settings/secrets/actions`

#### 生產環境 Secrets

| Secret 名稱 | 說明 | 範例值 |
|------------|------|--------|
| **服務器配置** |||
| `PROD_HOST` | 生產服務器 IP/域名 | `123.456.789.0` |
| `PROD_USERNAME` | SSH 用戶名 | `ubuntu` |
| `PROD_SSH_KEY` | SSH 私鑰（完整內容） | `-----BEGIN...` |
| `PROD_PORT` | SSH 端口（可選） | `22` |
| **應用配置** |||
| `PROD_API_URL` | 生產 API URL | `https://api.picklevibes.hk/api` |
| `PROD_SERVER_URL` | 生產服務器 URL | `https://api.picklevibes.hk` |
| `PROD_STRIPE_PUBLISHABLE_KEY` | Stripe 正式金鑰 | `pk_live_...` |
| `GA_TRACKING_ID` | Google Analytics ID | `G-7E971TSS9Q` |
| **通知配置（可選）** |||
| `SLACK_WEBHOOK_URL` | Slack Webhook URL | `https://hooks.slack.com/...` |

#### UAT 環境 Secrets

| Secret 名稱 | 說明 | 範例值 |
|------------|------|--------|
| `UAT_HOST` | UAT 服務器 IP/域名 | `uat.picklevibes.hk` |
| `UAT_USERNAME` | SSH 用戶名 | `ubuntu` |
| `UAT_SSH_KEY` | SSH 私鑰 | `-----BEGIN...` |
| `UAT_PORT` | SSH 端口 | `22` |
| `UAT_API_URL` | UAT API URL | `https://api-uat.picklevibes.hk/api` |
| `UAT_SERVER_URL` | UAT 服務器 URL | `https://api-uat.picklevibes.hk` |
| `UAT_STRIPE_PUBLISHABLE_KEY` | Stripe 測試金鑰 | `pk_test_...` |

### 步驟 2: 設置 GitHub Environments（推薦）

GitHub Environments 提供額外的保護和審核機制。

#### 創建 Production Environment

1. 訪問：`https://github.com/ice-solution/picklevibes/settings/environments`
2. 點擊 "New environment"
3. 名稱：`production`
4. 配置保護規則：
   - ✅ **Required reviewers**: 添加審核者（至少1人）
   - ✅ **Wait timer**: 設置等待時間（如5分鐘）
   - ✅ **Deployment branches**: 限制只能從 `main` 分支部署
5. 添加環境特定的 Secrets（同上表）

#### 創建 UAT Environment

1. 名稱：`uat`
2. 保護規則：
   - ✅ **Deployment branches**: 限制只能從 `uat` 分支部署
   - 可選：添加審核者
3. 添加 UAT 專用的 Secrets

### 步驟 3: 準備服務器

#### 生產服務器

```bash
# SSH 登入生產服務器
ssh user@prod-server

# 創建應用目錄
sudo mkdir -p /var/www/picklevibes
sudo chown -R $USER:$USER /var/www/picklevibes

# 安裝必要軟件
sudo apt update
sudo apt install -y nodejs npm
sudo npm install -g pm2

# 創建備份目錄
mkdir -p /var/www/picklevibes/backups

# 初始化 PM2
pm2 startup
```

#### UAT 服務器

```bash
# SSH 登入 UAT 服務器
ssh user@uat-server

# 創建應用目錄
sudo mkdir -p /var/www/picklevibes-uat
sudo chown -R $USER:$USER /var/www/picklevibes-uat

# 安裝軟件（同上）
# 創建備份目錄
mkdir -p /var/www/picklevibes-uat/backups
```

### 步驟 4: 配置服務器環境變數

#### 生產服務器

創建 `/var/www/picklevibes/.env.production`:

```env
NODE_ENV=production
PORT=5001

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/picklevibes

# JWT
JWT_SECRET=your-production-jwt-secret
JWT_EXPIRE=30d

# Stripe
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# URLs
CLIENT_URL=https://picklevibes.hk
CORS_ORIGIN=https://picklevibes.hk
```

#### UAT 服務器

創建 `/var/www/picklevibes-uat/.env.uat`:

```env
NODE_ENV=uat
PORT=5009

MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/picklevibes-uat
JWT_SECRET=your-uat-jwt-secret
STRIPE_SECRET_KEY=sk_test_your_test_key
# ... 其他 UAT 配置
```

### 步驟 5: 測試 CI/CD 流程

#### 測試 UAT 部署

```bash
# 1. 創建功能分支
git checkout -b feature/test-cicd

# 2. 做一些小改動
echo "// CI/CD test" >> client/src/App.tsx

# 3. 提交並推送到 uat 分支
git add .
git commit -m "test: 測試 CI/CD 流程"
git push origin feature/test-cicd

# 4. 在 GitHub 創建 PR 到 uat 分支
# 5. 合併 PR，自動觸發 UAT 部署
```

#### 測試生產部署

```bash
# 1. UAT 測試通過後，合併到 main 分支
git checkout main
git merge uat
git push origin main

# 2. 自動觸發生產部署
# 3. 如果設置了審核，需要批准後才會部署
```

## 📊 CI/CD 流程詳解

### Production 部署流程

```yaml
觸發條件: push to main
    ↓
Job 1: 測試和驗證 (3-5分鐘)
  - 安裝依賴
  - Linting
  - 單元測試（可選）
    ↓
Job 2: 建構前端 (5-10分鐘)
  - 使用生產環境配置
  - 建構優化版本
  - 上傳建構產物
    ↓
Job 3: 部署到生產 (2-5分鐘)
  - 下載建構產物
  - 創建部署包
  - 上傳到服務器
  - 備份舊版本
  - 部署新版本
  - 重啟 PM2
    ↓
Job 4: 驗證和通知 (1分鐘)
  - 健康檢查
  - 發送 Slack 通知
```

**總時長**: 約 11-21 分鐘

### UAT 部署流程

類似生產流程，但：
- 使用 UAT 配置
- 部署到 UAT 服務器
- 不需要審核（可選）

## 🔍 監控和日誌

### 查看 GitHub Actions 執行狀態

1. 訪問：`https://github.com/ice-solution/picklevibes/actions`
2. 選擇相應的 Workflow
3. 查看執行日誌和狀態

### 查看服務器日誌

```bash
# SSH 登入服務器
ssh user@server

# 查看 PM2 日誌
pm2 logs picklevibes

# 查看最近的部署日誌
pm2 logs picklevibes --lines 100
```

## 🚨 錯誤處理和回滾

### 如果部署失敗

#### 方法 1: 自動回滾（推薦）

在服務器上添加回滾腳本 `/var/www/picklevibes/rollback.sh`:

```bash
#!/bin/bash
set -e

APP_DIR="/var/www/picklevibes"
BACKUP_DIR="$APP_DIR/backups"

# 找到最近的備份
LATEST_BACKUP=$(ls -t $BACKUP_DIR | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "❌ 沒有找到備份"
  exit 1
fi

echo "🔄 回滾到: $LATEST_BACKUP"

# 恢復備份
rm -rf $APP_DIR/client/build
cp -r $BACKUP_DIR/$LATEST_BACKUP $APP_DIR/client/build

# 重啟應用
pm2 restart picklevibes

echo "✅ 回滾完成"
```

使用：
```bash
cd /var/www/picklevibes
./rollback.sh
```

#### 方法 2: 手動回滾

```bash
# 1. SSH 登入
ssh user@server

# 2. 恢復備份
cd /var/www/picklevibes
rm -rf client/build
cp -r backups/build-YYYYMMDD_HHMMSS client/build

# 3. 重啟
pm2 restart picklevibes
```

#### 方法 3: 重新部署舊版本

```bash
# 在本地
git log  # 找到穩定版本的 commit hash
git revert <commit-hash>
git push origin main  # 觸發重新部署
```

## 🎨 自定義和優化

### 添加單元測試

在 `.github/workflows/ci-cd-production.yml` 中取消註釋：

```yaml
- name: 運行測試
  run: |
    npm test
    cd client && npm test
```

### 添加 Email 通知

在 workflow 中取消註釋並配置：

```yaml
- name: 發送 Email 通知
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.MAIL_USERNAME }}
    password: ${{ secrets.MAIL_PASSWORD }}
    subject: 生產環境部署失敗
    body: 部署失敗，請查看日誌
    to: devops@picklevibes.hk
```

### 添加性能測試

```yaml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v9
  with:
    urls: |
      https://picklevibes.hk
      https://picklevibes.hk/booking
    uploadArtifacts: true
```

### 添加安全掃描

```yaml
- name: 安全掃描
  run: |
    npm audit
    cd client && npm audit
```

## 📝 最佳實踐

### 1. 分支策略

```
main (生產)
  ↑
uat (測試)
  ↑
develop (開發)
  ↑
feature/* (功能分支)
```

工作流程：
1. 從 `develop` 創建 `feature/*` 分支
2. 功能完成後合併到 `develop`
3. 測試通過後合併到 `uat` → 自動部署到 UAT
4. UAT 測試通過後合併到 `main` → 自動部署到生產

### 2. 提交訊息規範

使用 [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: 新增功能
fix: 修復 bug
docs: 文檔更新
style: 代碼格式
refactor: 重構
test: 測試
chore: 維護
```

### 3. 版本標籤

```bash
# 創建版本標籤
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### 4. 環境隔離

- Development: 本地開發
- UAT: 用戶驗收測試
- Staging: 預發布（可選）
- Production: 生產環境

## 🔐 安全建議

1. **保護 main 分支**
   - 啟用分支保護
   - 要求 PR 審核
   - 要求狀態檢查通過

2. **定期更新 Secrets**
   - SSH 金鑰
   - JWT Secret
   - API 金鑰

3. **最小權限原則**
   - GitHub Actions 使用專用的部署用戶
   - 限制 SSH 訪問

4. **日誌和監控**
   - 記錄所有部署
   - 設置告警
   - 定期審查

## 📚 相關資源

- [GitHub Actions 文檔](https://docs.github.com/en/actions)
- [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [PM2 文檔](https://pm2.keymetrics.io/)

## 🆘 故障排除

### 問題：GitHub Actions 失敗 "Permission denied"

**解決**:
1. 檢查 SSH 金鑰是否正確
2. 確認服務器的 `~/.ssh/authorized_keys` 包含對應公鑰
3. 測試 SSH 連接：`ssh -i ~/.ssh/key user@server`

### 問題：建構產物上傳失敗

**解決**:
1. 檢查 `upload-artifact` 步驟
2. 確認路徑正確
3. 檢查 GitHub Actions 儲存空間

### 問題：健康檢查失敗

**解決**:
1. 檢查 API 是否正常運行
2. 增加等待時間
3. 檢查防火牆設置

---

**最後更新**: 2025-01-12  
**維護者**: Picklevibes DevOps Team

