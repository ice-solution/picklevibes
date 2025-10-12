# UAT 環境快速參考

## 🚀 快速連結

| 資源 | URL |
|------|-----|
| 前端 | https://uat.picklevibes.hk |
| API | https://api-uat.picklevibes.hk |
| GitHub倉庫 | https://github.com/ice-solution/picklevibes |
| UAT分支 | https://github.com/ice-solution/picklevibes/tree/uat |

## 👤 測試帳號

| 角色 | 電子郵件 | 密碼 |
|------|---------|------|
| 管理員 | admin@picklevibes.hk | Test@1234 |
| VIP用戶 | vip@picklevibes.hk | Test@1234 |
| 普通用戶 | user@picklevibes.hk | Test@1234 |

## 💳 Stripe 測試卡

| 情境 | 卡號 |
|------|------|
| 成功支付 | 4242 4242 4242 4242 |
| 支付失敗 | 4000 0000 0000 0002 |
| 3D驗證 | 4000 0025 0000 3155 |

**其他信息**: CVC任意3位數字，到期日期任何未來日期

## 📋 常用命令

### 本地開發

```bash
# 切換到UAT分支
git checkout uat

# 拉取最新代碼
git pull origin uat

# 安裝依賴
npm install
cd client && npm install && cd ..

# 啟動開發環境
npm run dev
```

### 服務器操作

```bash
# SSH登入UAT服務器
ssh user@uat.picklevibes.hk

# 查看應用狀態
pm2 status

# 查看實時日誌
pm2 logs picklevibes-uat

# 重啟應用
pm2 restart picklevibes-uat

# 部署最新版本
cd /var/www/picklevibes-uat && ./deploy-uat.sh
```

### Git 操作

```bash
# 創建功能分支
git checkout -b feature/your-feature uat

# 提交更改
git add .
git commit -m "feat: 您的功能描述"

# 推送到遠端
git push origin feature/your-feature

# 合併到UAT
git checkout uat
git merge feature/your-feature
git push origin uat
```

## 🔧 故障排除

### 問題：應用無法啟動

```bash
# 檢查狀態
pm2 status

# 查看錯誤日誌
pm2 logs picklevibes-uat --err

# 重啟應用
pm2 restart picklevibes-uat
```

### 問題：數據庫連接失敗

1. 檢查 `.env.uat` 中的 `MONGODB_URI`
2. 確認MongoDB Atlas IP白名單
3. 測試連接：`mongo "your-mongodb-uri"`

### 問題：前端無法訪問API

1. 檢查 `client/.env.uat` 中的 `REACT_APP_API_URL`
2. 檢查CORS設置
3. 檢查Nginx配置

## 📊 健康檢查

```bash
# API健康檢查
curl https://api-uat.picklevibes.hk/api/health

# 檢查應用版本
curl https://api-uat.picklevibes.hk/api/version

# 檢查數據庫連接
curl https://api-uat.picklevibes.hk/api/db-status
```

## 🔔 通知設置

### Slack通知

當UAT環境部署完成或失敗時，會自動發送Slack通知到 `#uat-deployments` 頻道。

### Email通知

部署結果也會發送郵件到：deploy-notifications@picklevibes.hk

## 📝 快速測試

### 測試用戶註冊和登入

1. 訪問 https://uat.picklevibes.hk/register
2. 使用測試郵箱註冊：test-{timestamp}@example.com
3. 登入並確認功能正常

### 測試預約流程

1. 登入測試帳號
2. 選擇 "預約場地"
3. 選擇日期：明天
4. 選擇時間：14:00-15:00
5. 選擇場地：比賽場
6. 填寫玩家信息
7. 確認預約

### 測試充值流程

1. 登入測試帳號
2. 進入 "充值積分"
3. 選擇金額：500積分
4. 使用測試卡：4242 4242 4242 4242
5. 確認支付成功

### 測試管理功能

1. 使用管理員帳號登入
2. 進入管理頁面
3. 查看所有預約
4. 測試場地啟用/停用
5. 查看用戶列表

## 🚨 緊急聯繫

| 角色 | 聯繫方式 |
|------|---------|
| DevOps | devops@picklevibes.hk |
| 技術支援 | tech@picklevibes.hk |
| 項目經理 | pm@picklevibes.hk |
| 緊急電話 | +852 5600 4956 |

## 📚 相關文檔

- [完整部署指南](./UAT_DEPLOYMENT_GUIDE.md)
- [UAT README](./UAT_README.md)
- [測試計劃](./QA_Test_Plan.md)
- [API文檔](./API_DOCUMENTATION.md)

## 🔄 更新週期

- **代碼更新**: 每日（自動）
- **依賴更新**: 每週
- **數據重置**: 每月1日
- **安全補丁**: 立即

---

**最後更新**: 2025-01-12  
**維護者**: Picklevibes DevOps Team

