# Apache + PM2 部署指南

## 🔧 修正的配置說明

### 主要修正：

1. **DocumentRoot 路徑**
   ```apache
   # ❌ 錯誤
   DocumentRoot /var/www/html/picklevibes/clients
   
   # ✅ 正確
   DocumentRoot /var/www/html/picklevibes/client/build
   ```

2. **Directory 路徑修正**
   ```apache
   # ❌ 錯誤
   <Directory /var/www/pickevibes>  # 拼寫錯誤
   
   # ✅ 正確
   <Directory /var/www/html/picklevibes/client/build>
   ```

3. **端口修正**
   ```apache
   # ✅ 使用 5001 端口（與您的 PM2 配置一致）
   ProxyPass /api http://localhost:5001/api
   ProxyPassReverse /api http://localhost:5001/api
   ```

4. **添加 RewriteCond 排除 API**
   ```apache
   # 確保 /api 請求不被重定向到 index.html
   RewriteCond %{REQUEST_URI} !^/api
   ```

## 📁 目錄結構

您的服務器目錄結構應該是：

```
/var/www/html/picklevibes/
├── client/
│   ├── build/              ← Apache DocumentRoot 指向這裡
│   │   ├── index.html
│   │   ├── static/
│   │   │   ├── css/
│   │   │   └── js/
│   │   └── ...
│   ├── src/
│   └── package.json
├── server/
│   ├── index.js           ← PM2 啟動這個文件
│   ├── models/
│   ├── routes/
│   └── ...
├── .env                   ← 環境變量
└── package.json
```

## 🚀 部署步驟

### 方法 1: 使用自動部署腳本 (推薦)

```bash
# 1. 上傳文件到服務器
scp -r * root@your-server:/var/www/html/picklevibes/

# 2. 連接到服務器
ssh root@your-server

# 3. 運行部署腳本
cd /var/www/html/picklevibes
chmod +x deploy.sh
sudo bash deploy.sh
```

### 方法 2: 手動部署

#### 步驟 1: 安裝必要套件

```bash
# 更新系統
sudo apt-get update

# 安裝 Apache
sudo apt-get install apache2

# 安裝 Node.js 和 npm
sudo apt-get install nodejs npm

# 安裝 PM2
sudo npm install -g pm2
```

#### 步驟 2: 啟用 Apache 模組

```bash
sudo a2enmod rewrite
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod ssl
sudo a2enmod headers
sudo a2enmod expires
sudo a2enmod deflate
```

#### 步驟 3: 上傳項目文件

```bash
# 使用 git
cd /var/www/html
git clone https://github.com/your-username/picklevibes.git
cd picklevibes

# 或使用 scp
scp -r /local/path/to/picklevibes root@your-server:/var/www/html/
```

#### 步驟 4: 安裝依賴並構建

```bash
cd /var/www/html/picklevibes

# 安裝後端依賴
npm install

# 構建前端
cd client
npm install
npm run build
cd ..
```

#### 步驟 5: 設置環境變量

```bash
# 創建 .env 文件
nano /var/www/html/picklevibes/.env
```

添加以下內容：
```env
MONGODB_URI=mongodb+srv://icesolution19:jLuZY1Lbi5UQNtyz@cluster0.nky9l.mongodb.net/picklevibes
JWT_SECRET=your_production_secret_key_here
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
PORT=5001
NODE_ENV=production
CLIENT_URL=https://picklevibes.hk
```

#### 步驟 6: 配置 Apache

```bash
# 複製配置文件
sudo cp apache-config.conf /etc/apache2/sites-available/picklevibes.conf

# 啟用站點
sudo a2ensite picklevibes.conf

# 禁用默認站點
sudo a2dissite 000-default.conf

# 測試配置
sudo apache2ctl configtest

# 重啟 Apache
sudo systemctl restart apache2
```

#### 步驟 7: 啟動後端服務 (PM2)

```bash
cd /var/www/html/picklevibes

# 啟動應用
pm2 start server/index.js --name picklevibes

# 設置開機自啟
pm2 startup systemd
pm2 save
```

#### 步驟 8: 設置 SSL (Let's Encrypt)

```bash
# 安裝 Certbot
sudo apt-get install certbot python3-certbot-apache

# 獲取證書
sudo certbot --apache -d picklevibes.hk -d www.picklevibes.hk

# 自動續期測試
sudo certbot renew --dry-run
```

#### 步驟 9: 設置文件權限

```bash
sudo chown -R www-data:www-data /var/www/html/picklevibes/client/build
sudo chmod -R 755 /var/www/html/picklevibes/client/build
```

## 🔍 測試部署

```bash
# 1. 測試前端
curl http://picklevibes.hk

# 2. 測試 API
curl http://picklevibes.hk/api/courts

# 3. 檢查 PM2 狀態
pm2 status

# 4. 檢查 Apache 狀態
sudo systemctl status apache2
```

## 📊 監控和日誌

### PM2 日誌
```bash
# 查看所有日誌
pm2 logs

# 只看 picklevibes 日誌
pm2 logs picklevibes

# 清除日誌
pm2 flush
```

### Apache 日誌
```bash
# 錯誤日誌
sudo tail -f /var/log/apache2/picklevibes_error.log

# 訪問日誌
sudo tail -f /var/log/apache2/picklevibes_access.log
```

## 🔄 更新部署

```bash
# 1. 拉取最新代碼
cd /var/www/html/picklevibes
git pull origin main

# 2. 安裝依賴
npm install
cd client && npm install && cd ..

# 3. 重新構建前端
cd client
npm run build
cd ..

# 4. 重啟後端
pm2 restart picklevibes

# 5. 重新加載 Apache (如果配置有變)
sudo systemctl reload apache2
```

## 🐛 常見問題

### 1. Apache 無法啟動

```bash
# 檢查配置
sudo apache2ctl configtest

# 查看錯誤日誌
sudo tail -100 /var/log/apache2/error.log
```

### 2. API 返回 502 Bad Gateway

```bash
# 檢查後端是否運行
pm2 status

# 檢查端口是否正確
netstat -tulpn | grep 5001

# 重啟後端
pm2 restart picklevibes
```

### 3. 前端顯示空白頁

```bash
# 檢查構建文件是否存在
ls -la /var/www/html/picklevibes/client/build

# 檢查文件權限
sudo chown -R www-data:www-data /var/www/html/picklevibes/client/build
```

### 4. CORS 錯誤

確保 `server/index.js` 中的 CORS 設置包含您的域名：

```javascript
app.use(cors({
  origin: ['https://picklevibes.hk', 'http://picklevibes.hk'],
  credentials: true
}));
```

## 🔒 安全建議

1. **防火牆設置**
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

2. **定期更新**
```bash
sudo apt-get update
sudo apt-get upgrade
```

3. **備份數據庫**
```bash
# 創建備份腳本
mongodump --uri="your_mongodb_uri" --out=/backup/$(date +%Y%m%d)
```

4. **監控磁盤空間**
```bash
df -h
```

## 📞 支持

如遇到問題，請檢查：
- Apache 錯誤日誌: `/var/log/apache2/picklevibes_error.log`
- PM2 日誌: `pm2 logs picklevibes`
- 系統日誌: `journalctl -xe`

