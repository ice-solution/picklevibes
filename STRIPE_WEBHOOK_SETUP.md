# Stripe Webhook 設置指南

## 🎯 Webhook 功能

Webhook 讓 Stripe 自動通知您的後端支付狀態變化，實現：
- ✅ 自動確認預約
- ✅ 處理支付失敗
- ✅ 更新訂單狀態
- ✅ 記錄交易歷史

## 📍 Webhook 端點

您的 Webhook URL：
```
https://picklevibes.hk/api/payments/webhook
```

## 🔧 當前實現的事件

系統已實現以下 Stripe 事件處理：

### 1. `payment_intent.succeeded` - 支付成功
```javascript
✅ 更新預約狀態為 'confirmed'
✅ 標記支付狀態為 'paid'
✅ 記錄支付時間
✅ 更新 Stripe 交易記錄
```

### 2. `payment_intent.payment_failed` - 支付失敗
```javascript
✅ 更新預約狀態為 'cancelled'
✅ 標記支付狀態為 'failed'
✅ 更新 Stripe 交易記錄
```

### 3. `checkout.session.completed` - Checkout 完成
```javascript
✅ 確認預約
✅ 更新支付狀態
✅ 記錄交易信息
```

## 🚀 設置步驟

### 步驟 1: 獲取 Webhook 密鑰

#### 測試環境（開發用）

1. 登入 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 確保在 **測試模式** (Test mode)
3. 前往 **開發者** → **Webhooks**
4. 點擊 **添加端點**
5. 填寫：
   - **端點 URL**: `https://picklevibes.hk/api/payments/webhook`
   - **事件**: 選擇以下事件
     - ✅ `payment_intent.succeeded`
     - ✅ `payment_intent.payment_failed`
     - ✅ `checkout.session.completed`
6. 點擊 **添加端點**
7. 複製 **簽名密鑰** (whsec_...)

#### 生產環境（正式上線）

⚠️ **重要**: 切換到生產模式後重複上述步驟

1. 切換到 **生產模式** (Live mode)
2. 重複上述步驟
3. 複製 **生產環境**的簽名密鑰

### 步驟 2: 設置環境變量

在服務器上更新 `.env` 文件：

```bash
# 編輯環境變量
cd /var/www/html/picklevibes
nano .env
```

添加 Webhook 密鑰：
```env
# Stripe Webhook 密鑰
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 步驟 3: 重啟後端

```bash
# 重啟 PM2
pm2 restart picklevibes

# 查看日誌
pm2 logs picklevibes
```

### 步驟 4: 測試 Webhook

#### 方法 1: 使用 Stripe Dashboard 測試

1. 在 Stripe Dashboard 的 Webhooks 頁面
2. 點擊您的 webhook 端點
3. 點擊 **發送測試 webhook**
4. 選擇事件類型（例如 `payment_intent.succeeded`）
5. 點擊 **發送測試事件**

#### 方法 2: 實際支付測試

使用 Stripe 測試卡號：
```
卡號: 4242 4242 4242 4242
日期: 任何未來日期
CVC: 任何3位數字
郵編: 任何5位數字
```

## 🔍 驗證 Webhook 運作

### 檢查 Webhook 日誌

在 Stripe Dashboard:
1. 前往 **開發者** → **Webhooks**
2. 點擊您的端點
3. 查看 **最近的事件**
4. 應該看到：
   - ✅ HTTP 200 響應
   - ✅ 成功標記

### 檢查服務器日誌

```bash
# 查看 PM2 日誌
pm2 logs picklevibes --lines 100

# 應該看到：
# 支付成功: pi_xxxxxxxxxxxxx
# Webhook received: payment_intent.succeeded
```

### 檢查數據庫

```javascript
// 檢查預約狀態
db.bookings.find({ 
  "payment.transactionId": "pi_xxxxxxxxxxxxx" 
})

// 應該看到：
// status: "confirmed"
// payment.status: "paid"
// payment.paidAt: ISODate(...)
```

## 🔒 Webhook 安全

### 1. 簽名驗證

代碼已實現簽名驗證：
```javascript
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  req.body, 
  sig, 
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### 2. HTTPS 要求

⚠️ Stripe **必須**使用 HTTPS
- ✅ 您使用 Cloudflare，已經有 HTTPS
- ✅ Webhook URL: `https://picklevibes.hk/api/payments/webhook`

### 3. IP 白名單（可選）

可以限制只接受 Stripe IP：
```
34.226.0.0/16
35.71.131.0/24
```

## 📊 Webhook 事件處理流程

### 支付成功流程

```
用戶完成支付
    ↓
Stripe 處理支付
    ↓
Stripe 發送 webhook: payment_intent.succeeded
    ↓
您的服務器接收事件
    ↓
驗證簽名 ✅
    ↓
更新預約狀態: pending → confirmed
更新支付狀態: pending → paid
    ↓
返回 200 OK 給 Stripe
    ↓
用戶收到確認（如果有郵件通知）
```

### 支付失敗流程

```
用戶支付失敗
    ↓
Stripe 發送 webhook: payment_intent.payment_failed
    ↓
您的服務器接收事件
    ↓
更新預約狀態: pending → cancelled
更新支付狀態: pending → failed
    ↓
返回 200 OK 給 Stripe
```

## 🐛 故障排除

### 問題 1: Webhook 返回 400 錯誤

**症狀**: Stripe Dashboard 顯示 400 Bad Request

**原因**: 簽名驗證失敗

**解決**:
```bash
# 1. 檢查環境變量
cd /var/www/html/picklevibes
cat .env | grep STRIPE_WEBHOOK_SECRET

# 2. 確保密鑰正確（以 whsec_ 開頭）
# 3. 重啟後端
pm2 restart picklevibes
```

### 問題 2: Webhook 返回 500 錯誤

**症狀**: Stripe Dashboard 顯示 500 Internal Server Error

**原因**: 服務器代碼錯誤

**解決**:
```bash
# 查看詳細錯誤
pm2 logs picklevibes --err

# 檢查數據庫連接
# 檢查 Booking 和 StripeTransaction 模型
```

### 問題 3: Webhook 未被調用

**症狀**: 支付成功但狀態未更新

**檢查**:
```bash
# 1. 確認 Webhook 端點已添加到 Stripe
# 2. 確認 URL 正確: https://picklevibes.hk/api/payments/webhook
# 3. 測試服務器是否可訪問
curl https://picklevibes.hk/api/payments/webhook

# 4. 檢查防火牆是否阻擋 Stripe IP
```

### 問題 4: 預約狀態未更新

**症狀**: Webhook 收到但數據庫未更新

**調試**:
```javascript
// 在 webhook 處理代碼中添加日誌
console.log('收到 payment_intent:', paymentIntent.id);
console.log('查找預約:', { 'payment.transactionId': paymentIntent.id });

const booking = await Booking.findOne({ 
  'payment.transactionId': paymentIntent.id 
});
console.log('找到預約:', booking);
```

## 🧪 本地測試 Webhook

### 使用 Stripe CLI

```bash
# 1. 安裝 Stripe CLI
brew install stripe/stripe-cli/stripe
# 或從 https://stripe.com/docs/stripe-cli 下載

# 2. 登入
stripe login

# 3. 轉發 webhook 到本地
stripe listen --forward-to localhost:5001/api/payments/webhook

# 4. 複製顯示的 webhook 密鑰
# whsec_xxxxx

# 5. 更新本地 .env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# 6. 觸發測試事件
stripe trigger payment_intent.succeeded
```

## 📝 監控和日誌

### 添加更詳細的日誌

在 `server/routes/payments.js` 的 webhook 處理中：

```javascript
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  console.log('📥 收到 Webhook 請求');
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('✅ Webhook 簽名驗證成功');
    console.log('📋 事件類型:', event.type);
  } catch (err) {
    console.error('❌ Webhook 簽名驗證失敗:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ... 處理事件
  
  res.json({ received: true });
});
```

### 監控 Webhook 性能

在 Stripe Dashboard:
1. **開發者** → **Webhooks**
2. 查看 **成功率**
3. 查看 **平均響應時間**
4. 目標：
   - 成功率 > 99%
   - 響應時間 < 500ms

## ✅ 檢查清單

部署前確認：
- [ ] Webhook 端點已在 Stripe Dashboard 添加
- [ ] Webhook URL 使用 HTTPS
- [ ] `STRIPE_WEBHOOK_SECRET` 已設置在 `.env`
- [ ] 後端已重啟
- [ ] 測試事件返回 200 OK
- [ ] 實際支付測試成功
- [ ] 預約狀態正確更新
- [ ] 日誌顯示正常

## 📚 參考資料

- [Stripe Webhooks 文檔](https://stripe.com/docs/webhooks)
- [Stripe CLI 文檔](https://stripe.com/docs/stripe-cli)
- [測試 Webhooks](https://stripe.com/docs/webhooks/test)

## 🎉 完成！

現在您的系統會自動：
1. 接收 Stripe 的支付通知
2. 更新預約和支付狀態
3. 記錄所有交易
4. 處理支付失敗情況

建議定期檢查 Stripe Dashboard 的 Webhook 頁面，確保一切運作正常！

