# UAT 環境設置完成總結

## ✅ 已完成的工作

### 1. 分支管理
- ✅ 創建了 `uat` 分支
- ✅ 提交了場地管理功能更新
- ✅ 提交了UAT環境配置文件
- ✅ 提交了部署腳本和文檔

### 2. 配置文件

#### 環境配置範例
- ✅ `env.uat.example` - 後端環境配置範例
- ✅ `client/env.uat.example` - 前端環境配置範例

#### 部署配置
- ✅ `ecosystem.config.uat.js` - PM2進程管理配置
- ✅ `.github/workflows/uat-deploy.yml` - GitHub Actions自動部署工作流程
- ✅ `deploy-uat.sh` - UAT環境手動部署腳本

### 3. 文檔

#### 部署和維護文檔
- ✅ `UAT_DEPLOYMENT_GUIDE.md` - 完整的UAT部署指南
- ✅ `UAT_README.md` - UAT環境說明文檔
- ✅ `UAT_QUICK_REFERENCE.md` - 快速參考指南
- ✅ `GITHUB_SETUP_GUIDE.md` - GitHub設置步驟指南

### 4. Git 提交記錄

```
* 1025293 - docs: 添加GitHub UAT環境設置指南
* 6e27790 - feat: 建立UAT環境配置和部署流程
* f386c34 - feat: 添加場地管理功能 - 管理員可以啟用/停用場地
```

## 📋 下一步操作

### 必須完成的步驟

#### 1. 推送 UAT 分支到 GitHub

由於SSH權限問題，您需要手動推送分支：

**選項 A: 使用 HTTPS（推薦）**
```bash
git remote set-url origin https://github.com/ice-solution/picklevibes.git
git push -u origin uat
```

**選項 B: 配置 SSH 金鑰**
```bash
# 生成SSH金鑰
ssh-keygen -t ed25519 -C "your_email@example.com"

# 添加公鑰到GitHub
# GitHub > Settings > SSH and GPG keys > New SSH key

# 推送分支
git push -u origin uat
```

#### 2. 配置 GitHub Secrets

訪問：`https://github.com/ice-solution/picklevibes/settings/secrets/actions`

添加以下 Secrets（**必須**）：

| Secret 名稱 | 說明 | 範例 |
|------------|------|------|
| `UAT_HOST` | UAT服務器IP/域名 | `123.456.789.0` |
| `UAT_USERNAME` | SSH用戶名 | `ubuntu` |
| `UAT_SSH_KEY` | SSH私鑰（完整內容） | `-----BEGIN ... -----` |
| `UAT_API_URL` | API URL | `https://api-uat.picklevibes.hk/api` |
| `UAT_STRIPE_PUBLISHABLE_KEY` | Stripe測試可公開金鑰 | `pk_test_51ABC...` |

**可選但推薦**：
- `UAT_PORT` - SSH端口（默認22）
- `SLACK_WEBHOOK_URL` - Slack通知webhook
- 其他環境變量

#### 3. 設置分支保護規則

訪問：`https://github.com/ice-solution/picklevibes/settings/branches`

為 `uat` 分支添加保護規則：
- ☑️ Require status checks to pass before merging
- ☑️ Require branches to be up to date before merging

#### 4. 啟用 GitHub Actions

訪問：`https://github.com/ice-solution/picklevibes/settings/actions`

- 選擇 "Allow all actions and reusable workflows"
- 選擇 "Read and write permissions"

#### 5. 準備 UAT 服務器

在UAT服務器上執行：

```bash
# 安裝必要軟件
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 創建應用目錄
sudo mkdir -p /var/www/picklevibes-uat
sudo chown -R $USER:$USER /var/www/picklevibes-uat

# 克隆倉庫（推送UAT分支後）
cd /var/www/picklevibes-uat
git clone https://github.com/ice-solution/picklevibes.git .
git checkout uat

# 配置環境變量
cp env.uat.example .env.uat
nano .env.uat  # 填入實際配置

cp client/env.uat.example client/.env.uat
nano client/.env.uat  # 填入實際配置

# 安裝依賴並構建
npm install --production
cd client && npm install && npm run build && cd ..

# 啟動應用
pm2 start ecosystem.config.uat.js
pm2 save
pm2 startup
```

### 可選步驟

#### 配置 Nginx（如需要反向代理）

創建 `/etc/nginx/sites-available/picklevibes-uat`：

```nginx
# API服務器
server {
    listen 80;
    server_name api-uat.picklevibes.hk;
    
    location / {
        proxy_pass http://localhost:5009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 前端
server {
    listen 80;
    server_name uat.picklevibes.hk;
    
    root /var/www/picklevibes-uat/client/build;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

啟用配置：
```bash
sudo ln -s /etc/nginx/sites-available/picklevibes-uat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 設置 SSL 證書

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d uat.picklevibes.hk -d api-uat.picklevibes.hk
```

## 📚 文檔參考

完成上述步驟後，請參考以下文檔：

| 文檔 | 用途 |
|------|------|
| [GITHUB_SETUP_GUIDE.md](./GITHUB_SETUP_GUIDE.md) | GitHub詳細設置步驟 |
| [UAT_DEPLOYMENT_GUIDE.md](./UAT_DEPLOYMENT_GUIDE.md) | 完整部署指南 |
| [UAT_README.md](./UAT_README.md) | UAT環境說明 |
| [UAT_QUICK_REFERENCE.md](./UAT_QUICK_REFERENCE.md) | 快速參考 |

## 🧪 測試 UAT 環境

完成部署後，執行以下測試：

### 1. 自動部署測試

```bash
# 在本地進行小改動
git checkout uat
echo "test" >> test.txt
git add test.txt
git commit -m "test: 測試自動部署"
git push origin uat

# 訪問 GitHub Actions 查看部署進度
# https://github.com/ice-solution/picklevibes/actions
```

### 2. 功能測試

訪問 UAT 環境：`https://uat.picklevibes.hk`

使用測試帳號登入：
- 管理員: `admin@picklevibes.hk` / `Test@1234`
- VIP用戶: `vip@picklevibes.hk` / `Test@1234`
- 普通用戶: `user@picklevibes.hk` / `Test@1234`

測試主要功能：
- [ ] 用戶註冊/登入
- [ ] 預約場地
- [ ] 積分充值（使用測試卡：4242 4242 4242 4242）
- [ ] VIP會員功能
- [ ] 優惠碼使用
- [ ] 管理員功能

### 3. 性能測試

```bash
# API健康檢查
curl https://api-uat.picklevibes.hk/api/health

# 檢查響應時間
time curl https://api-uat.picklevibes.hk/api/courts
```

## 🔍 監控和維護

### 日常監控

```bash
# SSH登入UAT服務器
ssh user@uat.picklevibes.hk

# 查看應用狀態
pm2 status

# 查看實時日誌
pm2 logs picklevibes-uat

# 查看資源使用
pm2 monit
```

### 定期維護

- **每日**: 檢查GitHub Actions執行狀態
- **每週**: 檢查應用日誌和錯誤
- **每月**: 更新依賴包和安全補丁
- **每季**: 重置測試數據

## 🚨 故障排除

### 常見問題

**Q: 推送分支時 "Permission denied"**
```bash
# 使用HTTPS代替SSH
git remote set-url origin https://github.com/ice-solution/picklevibes.git
git push origin uat
```

**Q: GitHub Actions 失敗**
1. 檢查 Secrets 是否正確配置
2. 查看 Actions 日誌查找具體錯誤
3. 確認服務器SSH連接正常

**Q: 應用無法啟動**
```bash
# 查看PM2日誌
pm2 logs picklevibes-uat --err

# 檢查環境變量
cat .env.uat

# 重啟應用
pm2 restart picklevibes-uat
```

## 📞 支援

如需協助，請聯繫：

- **技術支援**: tech@picklevibes.hk
- **DevOps團隊**: devops@picklevibes.hk
- **緊急電話**: +852 5600 4956

## 🎯 預期結果

完成所有設置後，您將擁有：

1. ✅ 完整的UAT環境分支（`uat`）
2. ✅ 自動化部署流程（GitHub Actions）
3. ✅ 完善的文檔和指南
4. ✅ 測試帳號和測試數據
5. ✅ 監控和日誌系統
6. ✅ 故障排除指南

## 🎉 結語

UAT環境已準備就緒！所有必要的配置文件、部署腳本和文檔都已創建完成。

**下一步**：請按照本文檔的「必須完成的步驟」章節逐步執行，即可啟動完整的UAT環境。

如有任何問題或需要協助，請隨時聯繫我們的技術團隊。

---

**創建日期**: 2025-01-12  
**最後更新**: 2025-01-12  
**維護者**: Picklevibes DevOps Team  
**文檔版本**: 1.0.0

