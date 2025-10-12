# UAT 環境部署指南

## 概述

本指南說明如何設置和部署 Picklevibes 的 UAT（用戶驗收測試）環境。

## 環境架構

- **分支**: `uat`
- **域名**: https://uat.picklevibes.hk
- **API域名**: https://api-uat.picklevibes.hk
- **服務器**: UAT專用服務器
- **數據庫**: MongoDB Atlas（UAT專用集群）

## 前置需求

1. Node.js 18.x 或更高版本
2. MongoDB Atlas 帳號
3. Stripe 測試帳號
4. Twilio 測試帳號（用於WhatsApp）
5. GitHub 存取權限
6. UAT服務器SSH存取權限

## 初始設置

### 1. GitHub 倉庫設置

#### 創建 UAT 分支
```bash
# 切換到main分支
git checkout main

# 拉取最新代碼
git pull origin main

# 創建並切換到uat分支
git checkout -b uat

# 推送uat分支到遠端
git push origin uat
```

#### 設置 GitHub Secrets

在 GitHub 倉庫設置中，添加以下 Secrets（Settings > Secrets and variables > Actions）：

**服務器配置:**
- `UAT_HOST`: UAT服務器IP或域名
- `UAT_USERNAME`: SSH用戶名
- `UAT_SSH_KEY`: SSH私鑰
- `UAT_PORT`: SSH端口（默認22）

**環境變量:**
- `UAT_API_URL`: UAT環境的API URL
- `UAT_STRIPE_PUBLISHABLE_KEY`: Stripe測試環境可公開金鑰
- `UAT_MONGODB_URI`: MongoDB UAT數據庫連接字符串
- `UAT_JWT_SECRET`: JWT密鑰
- `UAT_STRIPE_SECRET_KEY`: Stripe測試環境密鑰
- `UAT_TWILIO_ACCOUNT_SID`: Twilio帳號SID
- `UAT_TWILIO_AUTH_TOKEN`: Twilio認證令牌

**通知配置（可選）:**
- `SLACK_WEBHOOK_URL`: Slack通知webhook URL

### 2. 服務器設置

#### 安裝必要軟件
```bash
# 更新系統
sudo apt update && sudo apt upgrade -y

# 安裝Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安裝PM2
sudo npm install -g pm2

# 安裝Nginx（如果需要）
sudo apt install -y nginx

# 安裝Git
sudo apt install -y git
```

#### 創建應用目錄
```bash
sudo mkdir -p /var/www/picklevibes-uat
sudo chown -R $USER:$USER /var/www/picklevibes-uat
cd /var/www/picklevibes-uat
```

#### 克隆倉庫
```bash
git clone git@github.com:ice-solution/picklevibes.git .
git checkout uat
```

#### 設置環境變量
```bash
# 複製環境配置範例
cp env.uat.example .env.uat
cp client/env.uat.example client/.env.uat

# 編輯配置文件，填入實際值
nano .env.uat
nano client/.env.uat
```

#### 安裝依賴並構建
```bash
# 安裝後端依賴
npm install --production

# 安裝前端依賴並構建
cd client
npm install
npm run build
cd ..
```

#### 啟動應用
```bash
# 使用PM2啟動
pm2 start ecosystem.config.uat.js

# 保存PM2配置
pm2 save

# 設置PM2開機自啟
pm2 startup
```

### 3. Nginx 配置（如果使用Nginx作為反向代理）

創建Nginx配置文件：
```bash
sudo nano /etc/nginx/sites-available/picklevibes-uat
```

配置內容：
```nginx
# API 服務器配置
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
        proxy_cache_bypass $http_upgrade;
    }
}

# 前端配置
server {
    listen 80;
    server_name uat.picklevibes.hk;

    root /var/www/picklevibes-uat/client/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

啟用配置：
```bash
sudo ln -s /etc/nginx/sites-available/picklevibes-uat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. SSL 證書設置（使用 Let's Encrypt）

```bash
# 安裝 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 獲取證書
sudo certbot --nginx -d uat.picklevibes.hk -d api-uat.picklevibes.hk

# 測試自動續期
sudo certbot renew --dry-run
```

### 5. 防火牆設置

```bash
# 允許SSH
sudo ufw allow 22/tcp

# 允許HTTP和HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 啟用防火牆
sudo ufw enable
```

## 部署流程

### 自動部署（推薦）

1. 將代碼合併到 `uat` 分支
2. 推送到 GitHub
3. GitHub Actions 自動觸發部署

```bash
git checkout uat
git merge main
git push origin uat
```

### 手動部署

如果需要手動部署：

```bash
# SSH 登入UAT服務器
ssh user@uat.picklevibes.hk

# 進入應用目錄
cd /var/www/picklevibes-uat

# 拉取最新代碼
git fetch origin
git checkout uat
git pull origin uat

# 安裝依賴
npm install --production

# 構建前端
cd client
npm install
npm run build
cd ..

# 重啟應用
pm2 restart picklevibes-uat

# 檢查狀態
pm2 status
pm2 logs picklevibes-uat
```

## 數據庫管理

### 創建UAT數據庫

1. 登入 MongoDB Atlas
2. 創建新的數據庫集群或使用現有集群
3. 創建數據庫 `picklevibes-uat`
4. 創建數據庫用戶並設置權限
5. 獲取連接字符串並更新到 `.env.uat`

### 初始化數據

```bash
# SSH 登入UAT服務器
cd /var/www/picklevibes-uat

# 運行種子數據腳本
node server/seed.js
```

### 從生產環境複製數據（可選）

如果需要從生產環境複製數據到UAT：

```bash
# 導出生產環境數據
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/picklevibes-prod"

# 導入到UAT環境
mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/picklevibes-uat" --drop
```

## 監控和日誌

### PM2 監控

```bash
# 查看應用狀態
pm2 status

# 查看日誌
pm2 logs picklevibes-uat

# 查看實時日誌
pm2 logs picklevibes-uat --lines 100

# 監控資源使用
pm2 monit
```

### 日誌位置

- **應用日誌**: `/var/www/picklevibes-uat/logs/`
- **Nginx日誌**: `/var/log/nginx/`
- **PM2日誌**: `~/.pm2/logs/`

## 測試

### 功能測試清單

在部署後，請測試以下功能：

- [ ] 用戶註冊和登入
- [ ] 預約場地
- [ ] 積分充值（使用測試信用卡）
- [ ] VIP會員升級
- [ ] 優惠碼使用
- [ ] 管理員功能
  - [ ] 查看所有預約
  - [ ] 管理場地狀態
  - [ ] 管理用戶
  - [ ] 管理優惠碼
- [ ] WhatsApp通知（如果啟用）
- [ ] 響應式設計（手機、平板、桌面）

### 測試帳號

創建以下測試帳號：

1. **普通用戶**: test-user@picklevibes.hk
2. **VIP用戶**: test-vip@picklevibes.hk
3. **管理員**: test-admin@picklevibes.hk

### Stripe 測試卡號

- 成功支付: `4242 4242 4242 4242`
- 失敗支付: `4000 0000 0000 0002`
- 需要3D驗證: `4000 0025 0000 3155`

## 故障排除

### 常見問題

#### 1. 應用無法啟動

```bash
# 檢查PM2狀態
pm2 status

# 查看錯誤日誌
pm2 logs picklevibes-uat --err

# 檢查環境變量
pm2 env 0
```

#### 2. 數據庫連接失敗

- 檢查 `.env.uat` 中的 `MONGODB_URI` 是否正確
- 確認MongoDB Atlas IP白名單設置
- 檢查數據庫用戶權限

#### 3. Stripe支付失敗

- 確認使用測試環境的API金鑰
- 檢查webhook配置
- 查看Stripe Dashboard的日誌

#### 4. Nginx 502 錯誤

```bash
# 檢查後端服務是否運行
pm2 status

# 檢查端口是否正確
netstat -tulpn | grep 5009

# 重啟Nginx
sudo systemctl restart nginx
```

### 重置UAT環境

如果需要完全重置UAT環境：

```bash
# 停止應用
pm2 stop picklevibes-uat

# 清除數據庫
mongo "mongodb+srv://cluster.mongodb.net/picklevibes-uat" --eval "db.dropDatabase()"

# 重新初始化
cd /var/www/picklevibes-uat
node server/seed.js

# 重啟應用
pm2 restart picklevibes-uat
```

## 安全建議

1. **使用強密碼**: 所有密鑰和密碼都應該使用強隨機字符串
2. **限制SSH訪問**: 使用SSH密鑰而非密碼，限制來源IP
3. **定期更新**: 定期更新系統和依賴包
4. **監控異常**: 設置監控和警報系統
5. **備份數據**: 定期備份數據庫
6. **限制API訪問**: 使用速率限制和CORS配置

## 維護計劃

- **每週**: 檢查日誌和監控指標
- **每月**: 更新依賴包和安全補丁
- **每季**: 檢查和優化性能
- **每半年**: 進行安全審計

## 聯繫方式

如有問題，請聯繫：
- **技術支援**: tech@picklevibes.hk
- **DevOps團隊**: devops@picklevibes.hk

## 參考資料

- [GitHub Actions 文檔](https://docs.github.com/en/actions)
- [PM2 文檔](https://pm2.keymetrics.io/)
- [Nginx 文檔](https://nginx.org/en/docs/)
- [MongoDB Atlas 文檔](https://docs.atlas.mongodb.com/)
- [Stripe 測試文檔](https://stripe.com/docs/testing)

