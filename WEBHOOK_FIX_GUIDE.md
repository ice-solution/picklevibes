# Stripe Webhook 修復指南

## 🐛 問題說明

### 錯誤訊息
```
Webhook簽名驗證失敗: Webhook payload must be provided as a string or a Buffer
```

### 原因
Express 的 `express.json()` 中間件會將請求體解析為 JavaScript 對象，但 Stripe webhook 需要**原始的 Buffer 數據**來驗證簽名。

## ✅ 解決方案

### 修復內容

#### 1. 修改 `server/index.js`

**關鍵**: Webhook 路由必須在 `express.json()` **之前**註冊

```javascript
// ✅ 正確順序

// 1. CORS 設置
app.use(cors({...}));

// 2. Webhook 專用的 raw body parser（必須在 express.json() 之前）
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// 3. 其他路由的 JSON parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 4. 路由
app.use('/api/payments', require('./routes/payments'));
```

#### 2. 修改 `server/routes/payments.js`

移除路由中重複的 `express.raw()`：

```javascript
// ❌ 錯誤（重複設置）
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {

// ✅ 正確
router.post('/webhook', async (req, res) => {
```

## 🚀 部署修復

### 在服務器上執行：

```bash
# 1. 拉取最新代碼
cd /var/www/html/picklevibes
git pull origin main

# 2. 確保環境變量設置正確
cat .env | grep STRIPE_WEBHOOK_SECRET

# 3. 重啟後端
pm2 restart picklevibes

# 4. 查看日誌
pm2 logs picklevibes --lines 50
```

### 或使用腳本：

```bash
chmod +x restart-services.sh
sudo bash restart-services.sh
```

## 🧪 測試 Webhook

### 方法 1: 使用 Stripe Dashboard

1. 訪問 https://dashboard.stripe.com/webhooks
2. 點擊您的 webhook 端點
3. 點擊 **發送測試 webhook**
4. 選擇 `payment_intent.succeeded`
5. 應該看到：
   - ✅ HTTP 200 響應
   - ✅ "成功" 標記

### 方法 2: 使用測試腳本

```bash
chmod +x test-webhook.sh
bash test-webhook.sh
```

### 方法 3: 實際支付測試

使用 Stripe 測試卡：
```
卡號: 4242 4242 4242 4242
日期: 任何未來日期
CVC: 任何3位數
```

## 📊 驗證成功

### 檢查後端日誌

```bash
pm2 logs picklevibes
```

應該看到：
```
✅ Webhook 簽名驗證成功
📋 事件類型: payment_intent.succeeded
支付成功: pi_xxxxxxxxxxxxx
```

### 檢查 Stripe Dashboard

1. 前往 **開發者** → **Webhooks**
2. 點擊您的端點
3. 查看 **最近的事件**
4. 應該看到綠色的 ✅ 勾選標記

### 檢查數據庫

預約狀態應該自動更新：
- `status`: `pending` → `confirmed`
- `payment.status`: `pending` → `paid`
- `payment.paidAt`: 自動記錄時間

## 🔍 中間件順序的重要性

### ❌ 錯誤順序（會導致問題）

```javascript
app.use(express.json());                    // 先解析 JSON
app.use('/api/payments', paymentsRouter);   // Webhook 收到的是對象
// → Stripe 簽名驗證失敗 ❌
```

### ✅ 正確順序

```javascript
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));  // Webhook 專用
app.use(express.json());                    // 其他路由解析 JSON
app.use('/api/payments', paymentsRouter);   // Webhook 收到的是 Buffer
// → Stripe 簽名驗證成功 ✅
```

## 📝 技術細節

### 為什麼需要 Raw Body？

Stripe 使用 HMAC SHA256 計算簽名：

```
signature = HMAC_SHA256(webhook_secret, raw_request_body)
```

如果請求體被解析為對象，就無法重新計算出相同的簽名。

### Express 中間件處理順序

```
請求到達
    ↓
1. /api/payments/webhook → express.raw() → req.body = Buffer ✅
    ↓
2. 其他路由 → express.json() → req.body = Object ✅
```

## 🔒 安全檢查

### 確保 Webhook Secret 已設置

```bash
# 檢查環境變量
cd /var/www/html/picklevibes
cat .env | grep STRIPE_WEBHOOK_SECRET

# 應該看到
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 驗證簽名

Webhook 處理代碼會自動驗證：

```javascript
const event = stripe.webhooks.constructEvent(
  req.body,          // Buffer（原始數據）
  sig,               // Stripe-Signature header
  process.env.STRIPE_WEBHOOK_SECRET  // 您的密鑰
);
// 如果簽名不匹配，會拋出錯誤
```

## 🎉 完成！

修復後：
- ✅ Webhook 可以正確驗證簽名
- ✅ 支付成功自動確認預約
- ✅ 支付失敗自動取消預約
- ✅ 所有交易記錄完整

## 📞 需要幫助？

如果仍有問題：

1. **檢查中間件順序**
   ```bash
   grep -A 20 "express.raw" server/index.js
   ```

2. **檢查 Webhook Secret**
   ```bash
   echo $STRIPE_WEBHOOK_SECRET
   ```

3. **查看詳細錯誤**
   ```bash
   pm2 logs picklevibes --err --lines 100
   ```

4. **測試本地 Webhook**（使用 Stripe CLI）
   ```bash
   stripe listen --forward-to localhost:5001/api/payments/webhook
   stripe trigger payment_intent.succeeded
   ```

