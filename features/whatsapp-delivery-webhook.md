# WhatsApp Delivery Webhook

## 背景

WhatsApp Cloud API send 成功只代表 Meta **接受 request**（`message_status: accepted`），  
**唔代表** 訊息已送達手機。實際狀態要靠 webhook 异步回報：

| Status | 意思 |
|--------|------|
| `sent` | 已離開 Meta |
| `delivered` | 已送達 user 裝置 |
| `read` | user 已讀 |
| `failed` | 送達失敗（`errors[]` 有 error code） |

之前 debug 時曾見到：

- **141006** — payment method 問題 → block business initiated（已用 billing 卡解決）
- **0 / 验证异常** — access token 問題
- **131026** — message undeliverable（号码、ToS、版本等）

有 webhook 之後唔使等 Insights，server log 即時睇到 fail reason。

---

## 建議 endpoint

```
GET  /api/whatsapp/webhook   — Meta verify（hub.verify_token）
POST /api/whatsapp/webhook   — 接收 status / inbound message
```

參考現有 Stripe webhook 模式：`server/index.js` 對 `/api/payments/webhook` 用 `express.raw()`。  
WhatsApp webhook **唔需要** raw body（JSON 即可），但要 **HMAC 驗簽**（見下）。

---

## Env 變數（新增）

```env
# Meta App → Settings → Basic → App Secret
WHATSAPP_APP_SECRET=your_meta_app_secret

# 自訂 verify token（Meta Developer Console webhook 設定時填同一個值）
WHATSAPP_WEBHOOK_VERIFY_TOKEN=picklevibes_whatsapp_verify_xxx

# 可選：只 log 唔 persist
WHATSAPP_WEBHOOK_LOG_INBOUND=1
```

---

## Meta Developer Console 設定

1. App → **WhatsApp** → **Configuration** → Webhook  
2. Callback URL：`https://api.picklevibes.hk/api/whatsapp/webhook`（UAT 用 `api-uat.picklevibes.hk`）  
3. Verify Token：同 `WHATSAPP_WEBHOOK_VERIFY_TOKEN`  
4. Subscribe field：**`messages`**（含 status updates 同 user 回覆）

---

## 實作步驟（建議檔案）

### 1. `server/routes/whatsappWebhook.js`

- **GET**：驗證 `hub.mode=subscribe`、`hub.verify_token`、`hub.challenge`  
- **POST**：
  - 讀 header `X-Hub-Signature-256`  
  - 用 `WHATSAPP_APP_SECRET` 驗證 body HMAC-SHA256  
  - 解析 `entry[].changes[].value.statuses[]`  
  - `console.log` 或寫 DB / VLog

### 2. `server/index.js`

```js
app.use('/api/whatsapp/webhook', require('./routes/whatsappWebhook'));
```

（POST 用 `express.json()` 即可；若驗簽要 raw body，可改用 raw middleware 只套在此 route。）

### 3. 驗簽 pseudo-code

```js
const crypto = require('crypto');

function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader.slice(7)),
    Buffer.from(expected)
  );
}
```

### 4. Status payload 範例

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "field": "messages",
      "value": {
        "metadata": { "phone_number_id": "1217396424783150" },
        "statuses": [{
          "id": "wamid.xxx",
          "status": "failed",
          "timestamp": "1234567890",
          "recipient_id": "85261515648",
          "errors": [{ "code": 131026, "title": "Message undeliverable" }]
        }]
      }
    }]
  }]
}
```

### 5. （可選）Persist

- 用現有 `VLog` model 或新 collection `WhatsAppMessageLog`  
- 欄位：`messageId`, `recipient`, `templateName`（send 時自己記）, `status`, `errorCode`, `raw`

Send 時在 `whatsappCloudService.js` 把 `messageId` 同 bookingId 一齊 log，方便 webhook 對照。

---

## 測試清單

- [ ] GET verify：Meta Console「Verify and save」成功  
- [ ] POST：send 一条 test template → log 出现 `sent` → `delivered`  
- [ ] 故意用无效 token send → webhook 收到 `failed` + error code  
- [ ] 验签失败时 return 403，唔处理 body  
- [ ] UAT / production 各设一次 callback URL（或共用 domain）

---

## 參考

- [Meta messages webhook](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/)
- [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/)
- 專案：`server/routes/payments.js`（Stripe webhook 範例）
