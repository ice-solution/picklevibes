# GitHub UAT 環境設置指南

## 概述

本指南將幫助您完成 Picklevibes UAT 環境在 GitHub 上的設置，包括分支保護、Secrets配置和Actions權限。

## 步驟 1: 推送 UAT 分支到 GitHub

由於SSH權限問題，您需要手動推送UAT分支到GitHub：

### 選項 A: 使用 HTTPS（推薦）

```bash
# 切換到UAT分支
git checkout uat

# 添加HTTPS遠端（如果尚未添加）
git remote set-url origin https://github.com/ice-solution/picklevibes.git

# 推送UAT分支
git push -u origin uat
```

### 選項 B: 配置 SSH 金鑰

```bash
# 生成新的SSH金鑰（如果沒有）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 啟動ssh-agent
eval "$(ssh-agent -s)"

# 添加SSH金鑰到ssh-agent
ssh-add ~/.ssh/id_ed25519

# 複製公鑰到剪貼板
pbcopy < ~/.ssh/id_ed25519.pub  # macOS
# 或
cat ~/.ssh/id_ed25519.pub  # 然後手動複製

# 訪問 GitHub > Settings > SSH and GPG keys > New SSH key
# 粘貼公鑰並保存

# 測試連接
ssh -T git@github.com

# 推送UAT分支
git push -u origin uat
```

## 步驟 2: 設置 GitHub Secrets

訪問您的GitHub倉庫設置：
https://github.com/ice-solution/picklevibes/settings/secrets/actions

點擊 "New repository secret" 並添加以下Secrets：

### 服務器配置

#### UAT_HOST
- **名稱**: `UAT_HOST`
- **值**: UAT服務器的IP地址或域名
- **範例**: `123.456.789.0` 或 `uat-server.picklevibes.hk`

#### UAT_USERNAME
- **名稱**: `UAT_USERNAME`
- **值**: SSH登入用戶名
- **範例**: `ubuntu` 或 `root`

#### UAT_SSH_KEY
- **名稱**: `UAT_SSH_KEY`
- **值**: SSH私鑰內容（完整的密鑰文件內容）
- **如何獲取**:
  ```bash
  cat ~/.ssh/id_rsa
  # 或
  cat ~/.ssh/id_ed25519
  ```
- **注意**: 複製完整的密鑰內容，包括 `-----BEGIN ... -----` 和 `-----END ... -----`

#### UAT_PORT (可選)
- **名稱**: `UAT_PORT`
- **值**: SSH端口
- **默認值**: `22`

### 環境變量

#### UAT_API_URL
- **名稱**: `UAT_API_URL`
- **值**: UAT環境的API URL
- **範例**: `https://api-uat.picklevibes.hk/api`

#### UAT_STRIPE_PUBLISHABLE_KEY
- **名稱**: `UAT_STRIPE_PUBLISHABLE_KEY`
- **值**: Stripe測試環境的可公開金鑰
- **範例**: `pk_test_51ABC...`

#### UAT_MONGODB_URI
- **名稱**: `UAT_MONGODB_URI`
- **值**: MongoDB UAT數據庫連接字符串
- **範例**: `mongodb+srv://user:pass@cluster0.mongodb.net/picklevibes-uat?retryWrites=true&w=majority`

#### UAT_JWT_SECRET
- **名稱**: `UAT_JWT_SECRET`
- **值**: JWT密鑰（隨機生成的強密碼）
- **生成方法**:
  ```bash
  openssl rand -base64 32
  ```

#### UAT_STRIPE_SECRET_KEY
- **名稱**: `UAT_STRIPE_SECRET_KEY`
- **值**: Stripe測試環境的密鑰
- **範例**: `sk_test_51ABC...`

#### UAT_TWILIO_ACCOUNT_SID
- **名稱**: `UAT_TWILIO_ACCOUNT_SID`
- **值**: Twilio帳號SID
- **範例**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### UAT_TWILIO_AUTH_TOKEN
- **名稱**: `UAT_TWILIO_AUTH_TOKEN`
- **值**: Twilio認證令牌
- **範例**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 通知配置（可選）

#### SLACK_WEBHOOK_URL
- **名稱**: `SLACK_WEBHOOK_URL`
- **值**: Slack Webhook URL（用於部署通知）
- **範例**: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`
- **如何獲取**:
  1. 訪問 https://api.slack.com/apps
  2. 創建新應用或選擇現有應用
  3. 啟用 "Incoming Webhooks"
  4. 添加新的Webhook到工作區
  5. 複製Webhook URL

## 步驟 3: 設置分支保護規則

訪問：https://github.com/ice-solution/picklevibes/settings/branches

### 保護 `main` 分支

1. 點擊 "Add rule"
2. 分支名稱模式: `main`
3. 啟用以下選項：
   - ☑️ Require a pull request before merging
   - ☑️ Require approvals (至少1個)
   - ☑️ Require status checks to pass before merging
   - ☑️ Require branches to be up to date before merging
   - ☑️ Include administrators
4. 點擊 "Create"

### 保護 `uat` 分支

1. 點擊 "Add rule"
2. 分支名稱模式: `uat`
3. 啟用以下選項：
   - ☑️ Require status checks to pass before merging
   - ☑️ Require branches to be up to date before merging
4. 點擊 "Create"

## 步驟 4: 啟用 GitHub Actions

1. 訪問：https://github.com/ice-solution/picklevibes/settings/actions
2. 在 "Actions permissions" 部分：
   - 選擇 "Allow all actions and reusable workflows"
3. 在 "Workflow permissions" 部分：
   - 選擇 "Read and write permissions"
   - ☑️ Allow GitHub Actions to create and approve pull requests
4. 點擊 "Save"

## 步驟 5: 測試 GitHub Actions

### 手動觸發部署

1. 訪問：https://github.com/ice-solution/picklevibes/actions
2. 選擇 "UAT 環境部署" workflow
3. 點擊 "Run workflow"
4. 選擇 `uat` 分支
5. 點擊 "Run workflow"
6. 查看執行結果

### 自動觸發部署

推送代碼到 `uat` 分支時會自動觸發部署：

```bash
git checkout uat
git add .
git commit -m "feat: 新功能"
git push origin uat
```

## 步驟 6: 設置環境（Environments）

GitHub Environments 可以提供更好的部署控制和審核：

1. 訪問：https://github.com/ice-solution/picklevibes/settings/environments
2. 點擊 "New environment"
3. 環境名稱: `uat`
4. 配置環境保護規則（可選）：
   - ☑️ Required reviewers（需要審核者批准部署）
   - ☑️ Wait timer（部署前等待時間）
   - ☑️ Deployment branches（限制可部署的分支）
5. 添加環境特定的Secrets（與Repository Secrets相同）
6. 點擊 "Save protection rules"

## 步驟 7: 設置通知

### Slack 通知

如果您使用Slack進行團隊協作：

1. 創建專用頻道（如 `#uat-deployments`）
2. 添加 Incoming Webhook 集成
3. 將 Webhook URL 添加到 GitHub Secrets
4. GitHub Actions 會自動發送部署通知

### Email 通知

GitHub 默認會發送以下通知到您的郵箱：
- Workflow 失敗
- Workflow 成功（可在設置中調整）

配置通知偏好：
1. 訪問：https://github.com/settings/notifications
2. 調整 "Actions" 部分的設置

## 步驟 8: 創建 Pull Request 模板

創建 `.github/PULL_REQUEST_TEMPLATE.md` 文件：

```bash
# 切換到main分支
git checkout main

# 創建PR模板目錄（如果不存在）
mkdir -p .github

# 創建PR模板
cat > .github/PULL_REQUEST_TEMPLATE.md << 'EOF'
## 變更說明

簡要描述此PR的變更內容

## 變更類型

- [ ] 新功能 (feature)
- [ ] Bug修復 (fix)
- [ ] 文檔更新 (docs)
- [ ] 樣式變更 (style)
- [ ] 代碼重構 (refactor)
- [ ] 性能優化 (perf)
- [ ] 測試 (test)
- [ ] 構建/部署 (build/ci)

## 測試

- [ ] 本地測試通過
- [ ] UAT環境測試通過
- [ ] 所有測試案例通過

## 檢查清單

- [ ] 代碼遵循項目規範
- [ ] 已添加/更新相關文檔
- [ ] 已添加/更新測試
- [ ] 無新的linter警告
- [ ] 已測試向後兼容性

## 截圖（如適用）

## 相關Issue

Closes #

## 額外說明
EOF

# 提交
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "docs: 添加PR模板"
git push origin main
```

## 步驟 9: 設置 Issue 模板

創建 `.github/ISSUE_TEMPLATE/bug_report.md`:

```bash
mkdir -p .github/ISSUE_TEMPLATE

cat > .github/ISSUE_TEMPLATE/bug_report.md << 'EOF'
---
name: Bug Report
about: 報告一個bug
title: '[BUG] '
labels: 'bug'
assignees: ''
---

## Bug 描述

清晰簡潔地描述bug

## 重現步驟

1. 前往 '...'
2. 點擊 '....'
3. 滾動到 '....'
4. 看到錯誤

## 預期行為

描述您期望發生什麼

## 實際行為

描述實際發生了什麼

## 截圖

如果適用，添加截圖幫助解釋問題

## 環境

- 環境: [如 UAT, Production]
- 瀏覽器: [如 Chrome, Safari]
- 版本: [如 22]
- 設備: [如 iPhone 12, Desktop]

## 額外信息

添加任何其他相關信息
EOF
```

## 步驟 10: 驗證設置

### 檢查清單

- [ ] UAT分支已推送到GitHub
- [ ] 所有GitHub Secrets已配置
- [ ] 分支保護規則已設置
- [ ] GitHub Actions已啟用
- [ ] 手動觸發部署測試成功
- [ ] 自動部署測試成功
- [ ] Slack通知（如使用）正常工作
- [ ] PR模板已創建
- [ ] Issue模板已創建

### 測試完整流程

1. **創建功能分支**
   ```bash
   git checkout uat
   git checkout -b feature/test-uat
   echo "test" > test.txt
   git add test.txt
   git commit -m "test: 測試UAT部署流程"
   git push origin feature/test-uat
   ```

2. **創建 Pull Request**
   - 訪問 GitHub 並創建 PR（feature/test-uat → uat）
   - 查看 PR 檢查是否通過

3. **合併 PR**
   - 審核並合併 PR
   - 查看 Actions 是否自動觸發部署

4. **驗證部署**
   - 訪問 UAT 環境確認變更已部署
   - 檢查 Slack 通知（如已設置）

## 故障排除

### 問題：GitHub Actions 失敗 "Permission denied"

**原因**: SSH金鑰配置錯誤

**解決方法**:
1. 確認 `UAT_SSH_KEY` Secret 包含完整的私鑰
2. 確認服務器的 `~/.ssh/authorized_keys` 包含對應的公鑰
3. 確認私鑰格式正確（開始和結束行包含在內）

### 問題：Workflow 無法找到分支

**原因**: 分支尚未推送到遠端

**解決方法**:
```bash
git push origin uat
```

### 問題：Secrets 無法訪問

**原因**: Secrets 名稱或權限設置錯誤

**解決方法**:
1. 檢查 Secret 名稱是否與 workflow 中的引用一致
2. 確認 Actions 權限已正確設置
3. 確認 workflow 文件中的 Secret 引用語法正確：`${{ secrets.SECRET_NAME }}`

### 問題：部署後應用無法訪問

**原因**: 服務器配置或網絡問題

**解決方法**:
1. SSH登入服務器檢查應用狀態：`pm2 status`
2. 檢查防火牆設置
3. 檢查Nginx配置
4. 查看應用日誌：`pm2 logs picklevibes-uat`

## 維護

### 定期更新 Secrets

建議每季度更新以下 Secrets：
- JWT_SECRET
- SESSION_SECRET
- SSH金鑰（如有安全需求）

### 審查 Actions 日誌

定期檢查 Actions 執行日誌，確保沒有警告或錯誤。

### 更新依賴

定期更新 GitHub Actions 使用的版本：
- `actions/checkout@v3` → 檢查最新版本
- `actions/setup-node@v3` → 檢查最新版本
- `appleboy/ssh-action@master` → 檢查最新版本

## 相關資源

- [GitHub Actions 文檔](https://docs.github.com/en/actions)
- [GitHub Secrets 文檔](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Environments 文檔](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)

---

**最後更新**: 2025-01-12  
**維護者**: Picklevibes DevOps Team

