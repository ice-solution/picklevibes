# PickleVibes 部署指南

## 📋 部署前檢查清單

### 環境變量設置
確保以下環境變量已在生產環境中設置：

```bash
# 數據庫
MONGODB_URI=your_mongodb_atlas_connection_string

# JWT
JWT_SECRET=your_secure_jwt_secret

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# 服務器
PORT=5001
NODE_ENV=production

# 前端URL
CLIENT_URL=https://your-frontend-domain.com
```

## 🚀 部署選項

### 選項 1: Vercel (前端) + Railway/Render (後端)

#### 前端部署 (Vercel)
```bash
# 1. 安裝 Vercel CLI
npm i -g vercel

# 2. 在 client 目錄下部署
cd client
vercel --prod
```

**Vercel 環境變量：**
- `REACT_APP_API_URL`: 後端 API URL (例如: https://your-api.railway.app)

#### 後端部署 (Railway)
```bash
# 1. 安裝 Railway CLI
npm i -g @railway/cli

# 2. 登入
railway login

# 3. 初始化項目
railway init

# 4. 部署
railway up
```

**Railway 環境變量：**
在 Railway Dashboard 中設置所有上述環境變量

### 選項 2: Heroku (全棧)

```bash
# 1. 安裝 Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# 2. 登入
heroku login

# 3. 創建應用
heroku create your-app-name

# 4. 設置環境變量
heroku config:set MONGODB_URI=your_mongodb_uri
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set STRIPE_SECRET_KEY=your_stripe_key
# ... 其他環境變量

# 5. 部署
git push heroku main
```

### 選項 3: AWS/DigitalOcean/VPS

#### 使用 PM2 運行
```bash
# 1. 安裝 PM2
npm install -g pm2

# 2. 構建前端
cd client
npm run build

# 3. 使用 PM2 啟動後端
cd ..
pm2 start server/index.js --name picklevibes

# 4. 設置開機自啟
pm2 startup
pm2 save
```

#### Nginx 配置
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        root /path/to/picklevibes/client/build;
        try_files $uri /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 安全檢查

1. ✅ 確保 `.env` 文件在 `.gitignore` 中
2. ✅ 使用強密碼作為 JWT_SECRET
3. ✅ 啟用 CORS 僅允許信任的域名
4. ✅ 在生產環境中使用 HTTPS
5. ✅ 設置 Stripe Webhook 端點
6. ✅ 定期備份 MongoDB 數據庫

## 📊 性能優化

### 前端
- ✅ 使用 `npm run build` 構建優化版本
- ✅ 啟用 CDN 加速靜態資源
- ✅ 啟用 gzip 壓縮

### 後端
- ✅ 使用 PM2 cluster 模式
- ✅ 啟用 MongoDB 索引
- ✅ 配置 Redis 緩存（可選）

## 🐛 故障排除

### 常見問題

1. **CORS 錯誤**
   - 檢查 `CLIENT_URL` 環境變量
   - 更新 `server/index.js` 中的 CORS 配置

2. **數據庫連接失敗**
   - 檢查 `MONGODB_URI` 格式
   - 確認 MongoDB Atlas 白名單包含服務器 IP

3. **Stripe 支付失敗**
   - 驗證 Stripe 密鑰是否為生產密鑰
   - 設置 Stripe Webhook URL

## 📞 支持

如有問題，請查看日誌：
```bash
# PM2 日誌
pm2 logs picklevibes

# Heroku 日誌
heroku logs --tail

# Railway 日誌
railway logs
```

