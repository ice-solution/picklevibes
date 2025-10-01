# Cloudflare + Apache 部署指南

## 🌐 使用 Cloudflare SSL 的部署配置

既然您已經在 Cloudflare 設定了 **Flexible SSL**，就不需要在服務器上安裝 Let's Encrypt 證書了。

## 📊 SSL 模式說明

### Cloudflare SSL 模式對比

| 模式 | 瀏覽器 → Cloudflare | Cloudflare → 服務器 | 需要服務器證書 |
|------|-------------------|-------------------|-------------|
| **Flexible** (您的設定) | ✅ HTTPS (加密) | ❌ HTTP (未加密) | ❌ 不需要 |
| **Full** | ✅ HTTPS (加密) | ✅ HTTPS (加密) | ✅ 需要（可自簽） |
| **Full (Strict)** | ✅ HTTPS (加密) | ✅ HTTPS (加密) | ✅ 需要（必須有效） |

### 您的配置 (Flexible SSL)

```
瀏覽器 <--HTTPS--> Cloudflare <--HTTP--> 您的服務器 (Port 80)
```

## 🔧 Apache 配置

### 使用專門的配置文件

```bash
# 使用 Cloudflare 專用配置
sudo cp apache-config-cloudflare.conf /etc/apache2/sites-available/picklevibes.conf
```

### 關鍵差異

與標準配置的主要差異：

1. **只監聽 Port 80**
   ```apache
   <VirtualHost *:80>  # 不需要 443
   ```

2. **不需要 SSL 證書**
   ```apache
   # 不需要這些
   # SSLEngine on
   # SSLCertificateFile
   # SSLCertificateKeyFile
   ```

3. **不強制 HTTPS 重定向**
   ```apache
   # 不需要 HTTP → HTTPS 重定向
   # Cloudflare 已經處理了
   ```

4. **信任 Cloudflare IP**
   ```apache
   <IfModule mod_remoteip.c>
       RemoteIPHeader CF-Connecting-IP
       RemoteIPTrustedProxy 173.245.48.0/20
       # ... 更多 Cloudflare IP 範圍
   </IfModule>
   ```

## 🚀 部署步驟

### 步驟 1: 安裝必要套件

```bash
sudo apt-get update
sudo apt-get install apache2 nodejs npm
```

### 步驟 2: 啟用 Apache 模組

```bash
sudo a2enmod rewrite
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod headers
sudo a2enmod expires
sudo a2enmod deflate
sudo a2enmod remoteip  # 獲取真實 IP
```

### 步驟 3: 配置 Apache

```bash
# 複製 Cloudflare 配置
sudo cp /var/www/html/picklevibes/apache-config-cloudflare.conf /etc/apache2/sites-available/picklevibes.conf

# 啟用站點
sudo a2ensite picklevibes.conf

# 禁用默認站點
sudo a2dissite 000-default.conf

# 測試配置
sudo apache2ctl configtest

# 重啟 Apache
sudo systemctl restart apache2
```

### 步驟 4: 構建前端

```bash
cd /var/www/html/picklevibes/client

# 創建生產環境配置
nano .env.production
```

添加：
```env
REACT_APP_API_URL=/api
REACT_APP_SERVER_URL=
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY
REACT_APP_NODE_ENV=production
```

構建：
```bash
npm install
npm run build
```

### 步驟 5: 啟動後端 (PM2)

```bash
cd /var/www/html/picklevibes

# 安裝 PM2
sudo npm install -g pm2

# 啟動應用
pm2 start ecosystem.config.js

# 設置開機自啟
pm2 startup
pm2 save
```

## ☁️ Cloudflare 設置

### DNS 設置

1. 登入 Cloudflare Dashboard
2. 選擇您的域名 `picklevibes.hk`
3. DNS 記錄設置：

| 類型 | 名稱 | 內容 | 代理狀態 | TTL |
|------|------|------|---------|-----|
| A | @ | your.server.ip.address | ✅ 已代理 (橙色雲朵) | Auto |
| CNAME | www | picklevibes.hk | ✅ 已代理 (橙色雲朵) | Auto |

⚠️ **重要**: 確保「代理狀態」是**已代理**（橙色雲朵），這樣才能使用 Cloudflare SSL！

### SSL/TLS 設置

1. 前往 **SSL/TLS** → **概觀**
2. 加密模式選擇：**Flexible** ✅（您已設定）
3. 其他建議設置：
   - **Always Use HTTPS**: 開啟 ✅
   - **Automatic HTTPS Rewrites**: 開啟 ✅
   - **Minimum TLS Version**: TLS 1.2

### 速度優化設置

1. **速度** → **優化**
   - Auto Minify: 開啟 JavaScript, CSS, HTML ✅
   - Brotli: 開啟 ✅
   - Early Hints: 開啟 ✅

2. **快取** → **設定**
   - 快取層級: 標準 ✅
   - 瀏覽器快取 TTL: 4 小時

3. **速度** → **優化傳送**
   - Rocket Loader: 可選（測試後決定）
   - Mirage: 開啟 ✅

### 安全設置

1. **安全性** → **設定**
   - 安全層級: 中 ✅
   - Bot Fight Mode: 開啟 ✅

2. **SSL/TLS** → **Edge 憑證**
   - Always Use HTTPS: 開啟 ✅
   - HTTP Strict Transport Security (HSTS): 開啟（可選）

## 🔍 驗證部署

### 1. 檢查 DNS 傳播

```bash
# 檢查 DNS
nslookup picklevibes.hk

# 或使用線上工具
# https://www.whatsmydns.net/
```

### 2. 檢查 SSL

訪問：https://picklevibes.hk
- 瀏覽器應該顯示 🔒 鎖頭圖標
- 證書應該是 Cloudflare 簽發的

### 3. 檢查 API

```bash
# 應該返回場地列表
curl https://picklevibes.hk/api/courts
```

### 4. 檢查真實 IP 記錄

```bash
# 查看 Apache 日誌，應該顯示真實訪客 IP，不是 Cloudflare IP
sudo tail -f /var/log/apache2/picklevibes_access.log
```

## ⚠️ Cloudflare Flexible SSL 的限制

### 優點
- ✅ 快速設置，無需證書
- ✅ 瀏覽器到 Cloudflare 是加密的
- ✅ 免費

### 缺點
- ❌ Cloudflare 到服務器是**未加密**的 HTTP
- ❌ 理論上 Cloudflare 可以看到流量內容
- ❌ 不符合某些合規要求（如 PCI DSS）

### 建議
如果處理敏感數據（如支付信息），建議升級到 **Full SSL**：

1. 在服務器安裝 SSL 證書：
   ```bash
   sudo apt-get install certbot python3-certbot-apache
   sudo certbot --apache -d picklevibes.hk -d www.picklevibes.hk
   ```

2. 在 Cloudflare 改為 **Full** 或 **Full (Strict)** 模式

3. 使用原來的 `apache-config.conf` 配置

## 🐛 常見問題

### 問題 1: 無限重定向

**症狀**: 訪問網站時出現 "重定向次數過多" 錯誤

**原因**: Apache 配置中有 HTTPS 重定向，與 Cloudflare 衝突

**解決**: 
```bash
# 確保使用 Cloudflare 專用配置
sudo cp apache-config-cloudflare.conf /etc/apache2/sites-available/picklevibes.conf
sudo systemctl restart apache2
```

### 問題 2: 顯示 Cloudflare IP 而非真實訪客 IP

**症狀**: 日誌中都是 Cloudflare 的 IP (173.245.x.x 等)

**解決**:
```bash
# 啟用 remoteip 模組
sudo a2enmod remoteip
sudo systemctl restart apache2
```

### 問題 3: 502 Bad Gateway

**症狀**: Cloudflare 顯示 502 錯誤

**檢查**:
```bash
# 1. 檢查後端是否運行
pm2 status

# 2. 檢查 Apache 是否運行
sudo systemctl status apache2

# 3. 檢查防火牆
sudo ufw status
sudo ufw allow 80/tcp
```

### 問題 4: API 請求失敗

**症狀**: 前端無法連接到 API

**檢查**:
```bash
# 1. 測試本地 API
curl http://localhost:5001/api/courts

# 2. 測試通過 Apache
curl http://localhost/api/courts

# 3. 測試通過域名（從服務器）
curl http://picklevibes.hk/api/courts

# 4. 檢查 Apache 錯誤日誌
sudo tail -100 /var/log/apache2/picklevibes_error.log
```

## 📊 性能優化

### 1. 啟用 Cloudflare 快取

在 `apache-config-cloudflare.conf` 中已經設置了靜態資源快取標頭，Cloudflare 會自動快取這些資源。

### 2. 設置頁面規則（可選）

在 Cloudflare Dashboard:
1. **規則** → **頁面規則**
2. 創建規則：
   - URL: `picklevibes.hk/static/*`
   - 設定: 快取層級 = 快取所有內容
   - 邊緣快取 TTL = 1 個月

### 3. 啟用 Argo Smart Routing（付費功能）

可以加速 Cloudflare 到您服務器的連接。

## 🔒 安全建議

### 1. 限制只允許 Cloudflare IP 訪問

在 Apache 配置中添加：
```apache
<Directory /var/www/html/picklevibes/client/build>
    # 只允許 Cloudflare IP
    Require ip 173.245.48.0/20
    Require ip 103.21.244.0/22
    # ... 添加所有 Cloudflare IP 範圍
    # 或者允許所有，因為已經通過 Cloudflare
    Require all granted
</Directory>
```

### 2. 使用 Cloudflare 防火牆規則

設置規則阻擋惡意流量：
- 限制請求頻率
- 阻擋可疑國家/地區
- Challenge 模式

### 3. 定期更新服務器

```bash
sudo apt-get update
sudo apt-get upgrade
```

## 📞 需要幫助？

常用命令：
```bash
# 重啟 Apache
sudo systemctl restart apache2

# 重啟後端
pm2 restart picklevibes

# 查看日誌
sudo tail -f /var/log/apache2/picklevibes_error.log
pm2 logs picklevibes

# 測試配置
sudo apache2ctl configtest
```

Cloudflare 狀態頁面：
- https://www.cloudflarestatus.com/

## ✅ 檢查清單

部署完成後檢查：
- [ ] DNS 已指向服務器 IP
- [ ] Cloudflare 代理已開啟（橙色雲朵）
- [ ] SSL 模式設為 Flexible
- [ ] 可以訪問 https://picklevibes.hk
- [ ] API 正常工作 https://picklevibes.hk/api/courts
- [ ] 用戶可以註冊/登入
- [ ] 預約功能正常
- [ ] Stripe 支付正常
- [ ] Apache 日誌顯示真實 IP

