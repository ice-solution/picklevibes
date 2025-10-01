# 🚀 部署前檢查清單

## ✅ 必須完成的項目

### 1. 代碼準備
- [ ] 所有功能已測試
- [ ] 已修復所有已知 bug
- [ ] 代碼已提交到 Git
- [ ] 已創建生產分支或標籤

### 2. 環境配置
- [ ] `.env` 文件已準備好（不要提交到 Git）
- [ ] 所有環境變量已確認：
  - [ ] `MONGODB_URI` - MongoDB Atlas 連接字符串
  - [ ] `JWT_SECRET` - 強密碼（至少 32 個字符）
  - [ ] `STRIPE_SECRET_KEY` - **生產環境密鑰** (sk_live_...)
  - [ ] `STRIPE_PUBLISHABLE_KEY` - **生產環境密鑰** (pk_live_...)
  - [ ] `STRIPE_WEBHOOK_SECRET` - Webhook 密鑰
  - [ ] `PORT=5001`
  - [ ] `NODE_ENV=production`
  - [ ] `CLIENT_URL=https://picklevibes.hk`

### 3. 數據庫設置
- [ ] MongoDB Atlas 已設置
- [ ] 數據庫白名單包含服務器 IP
- [ ] 已運行 seed 腳本（如需要）
- [ ] 數據庫備份計劃已設置

### 4. Stripe 配置
- [ ] 已切換到生產環境密鑰
- [ ] Webhook 端點已設置：`https://picklevibes.hk/api/payments/webhook`
- [ ] Webhook 事件已選擇：
  - [ ] `payment_intent.succeeded`
  - [ ] `payment_intent.payment_failed`
  - [ ] `checkout.session.completed`
- [ ] 已測試測試模式支付流程

### 5. 服務器準備
- [ ] 服務器已安裝 Node.js (v14+)
- [ ] Apache 已安裝並配置
- [ ] PM2 已安裝
- [ ] 防火牆規則已設置（80, 443, 22）
- [ ] SSL 證書已準備（Let's Encrypt）

### 6. 文件上傳
- [ ] 項目文件已上傳到 `/var/www/html/picklevibes`
- [ ] `.env` 文件已單獨上傳（不在 Git 中）
- [ ] Apache 配置文件已複製
- [ ] 文件權限已設置正確

### 7. 構建和部署
- [ ] 前端已構建：`cd client && npm run build`
- [ ] Apache 配置已測試：`apache2ctl configtest`
- [ ] PM2 已啟動後端
- [ ] Apache 已重啟

### 8. DNS 設置
- [ ] 域名 A 記錄指向服務器 IP
- [ ] www 子域名已設置（可選）
- [ ] DNS 傳播已完成（可能需要 24-48 小時）

### 9. SSL/HTTPS
- [ ] Let's Encrypt 證書已安裝
- [ ] HTTP 自動重定向到 HTTPS
- [ ] 證書自動續期已設置

### 10. 測試
- [ ] 前端可訪問：`https://picklevibes.hk`
- [ ] API 可訪問：`https://picklevibes.hk/api/courts`
- [ ] 用戶註冊/登錄正常
- [ ] 預約流程正常
- [ ] Stripe 支付正常
- [ ] 管理後台正常

### 11. 監控和日誌
- [ ] PM2 日誌可訪問
- [ ] Apache 日誌可訪問
- [ ] 錯誤監控已設置（可選）
- [ ] 性能監控已設置（可選）

### 12. 備份計劃
- [ ] 數據庫備份腳本已設置
- [ ] 代碼備份計劃已設置
- [ ] 恢復流程已測試

## 🔧 部署命令快速參考

### 前端構建
```bash
cd /var/www/html/picklevibes/client
npm install
npm run build
```

### 啟動後端（使用 PM2）
```bash
cd /var/www/html/picklevibes
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 或手動啟動
```bash
pm2 start server/index.js --name picklevibes
pm2 save
```

### Apache 重啟
```bash
sudo systemctl restart apache2
```

### 查看狀態
```bash
pm2 status
pm2 logs picklevibes
sudo systemctl status apache2
```

## 🚨 緊急回滾計劃

如果部署出現問題：

1. **停止服務**
```bash
pm2 stop picklevibes
sudo systemctl stop apache2
```

2. **恢復數據庫**
```bash
mongorestore --uri="your_mongodb_uri" --drop /backup/latest
```

3. **切換到之前的版本**
```bash
cd /var/www/html/picklevibes
git checkout previous-stable-tag
npm install
cd client && npm install && npm run build
```

4. **重啟服務**
```bash
pm2 restart picklevibes
sudo systemctl start apache2
```

## 📞 問題排查

### API 無法訪問
1. 檢查 PM2: `pm2 status`
2. 檢查端口: `netstat -tulpn | grep 5001`
3. 檢查日誌: `pm2 logs picklevibes`
4. 檢查防火牆: `sudo ufw status`

### 前端顯示錯誤
1. 檢查構建: `ls -la client/build`
2. 檢查權限: `ls -la /var/www/html/picklevibes/client/build`
3. 檢查 Apache 配置: `apache2ctl configtest`
4. 檢查日誌: `tail -f /var/log/apache2/picklevibes_error.log`

### CORS 錯誤
1. 檢查 `CLIENT_URL` 環境變量
2. 檢查 `server/index.js` CORS 配置
3. 重啟 PM2: `pm2 restart picklevibes`

## ✨ 部署完成後

- [ ] 通知團隊部署完成
- [ ] 更新文檔
- [ ] 監控錯誤日誌（至少 24 小時）
- [ ] 收集用戶反饋
- [ ] 慶祝！🎉

