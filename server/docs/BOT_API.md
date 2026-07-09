# Bot API（n8n / WhatsApp）

供 n8n、WhatsApp 自動化查詢積分、場地空缺及建立預約。與前台 `POST /api/bookings` 使用相同業務規則（扣積分、時長 1–2 小時、VIP 折扣等）。

## 認證

在 `.env` 設定：

```env
BOT_API_KEY=你的隨機長字串
```

每個請求必須帶 Header：

```http
X-Bot-Key: <BOT_API_KEY>
```

未設定 `BOT_API_KEY` 時回傳 `503`；Key 錯誤回傳 `401`。

速率限制：每分鐘最多 60 次請求。

---

## 回應格式

成功：

```json
{ "success": true, "data": { ... } }
```

失敗：

```json
{
  "success": false,
  "code": "USER_NOT_FOUND",
  "message": "找不到此電話號碼的用戶"
}
```

積分不足時會多返 `details`：

```json
{
  "success": false,
  "code": "INSUFFICIENT_BALANCE",
  "message": "積分餘額不足",
  "details": {
    "required": 400,
    "available": 200,
    "discount": "無折扣"
  }
}
```

---

## 1. 電話查積分

```http
GET /api/bot/balance?phone={電話}
```

### Query

| 參數 | 必填 | 說明 |
|------|------|------|
| `phone` | ✅ | 用戶電話。支援 `91234567`、`85291234567`、`+85291234567` |

### 成功回應示例

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "665a1b2c3d4e5f6789012345",
      "name": "陳大文",
      "email": "user@example.com",
      "phone": "91234567",
      "membershipLevel": "basic",
      "role": "user"
    },
    "balance": 1500,
    "totalRecharged": 3000,
    "totalSpent": 1500
  }
}
```

### 錯誤 code

| code | HTTP | 說明 |
|------|------|------|
| `USER_NOT_FOUND` | 404 | 電話對應唔到已註冊用戶 |

---

## 2. 查場地空缺

一次查詢指定店鋪、日期、時段內**所有場地**嘅可否預約狀態。

```http
GET /api/bot/availability?store={店鋪ID}&date={日期}&startTime={開始}&endTime={結束}
```

### Query

| 參數 | 必填 | 說明 |
|------|------|------|
| `store` | ✅ | 店鋪 MongoDB `_id`（可先 call `GET /api/stores`） |
| `date` | ✅ | `YYYY-MM-DD` |
| `startTime` | ✅ | `HH:MM`，例如 `18:00` |
| `endTime` | ✅ | `HH:MM` 或 `24:00` |
| `courtType` | ❌ | 篩選場地類型：`competition` / `training` / `solo` / `dink` / `full_venue` |

### 成功回應示例

```json
{
  "success": true,
  "data": {
    "store": { "id": "...", "name": "PickleVibes 旺角", "slug": "mk" },
    "date": "2026-07-10",
    "startTime": "18:00",
    "endTime": "20:00",
    "duration": 120,
    "summary": { "total": 4, "available": 2, "unavailable": 2 },
    "availableCourts": [
      {
        "courtId": "...",
        "courtName": "1號場",
        "courtNumber": 1,
        "courtType": "competition",
        "available": true,
        "pricing": {
          "basePrice": 200,
          "totalPrice": 400,
          "duration": 120,
          "isPeakHour": true,
          "slotName": "高峰時段"
        }
      }
    ],
    "unavailableCourts": [
      {
        "courtId": "...",
        "courtName": "2號場",
        "available": false,
        "reason": "該時間段已被預約"
      }
    ]
  }
}
```

### 錯誤 code

| code | HTTP | 說明 |
|------|------|------|
| `STORE_NOT_FOUND` | 404 | 店鋪不存在 |
| `STORE_INACTIVE` | 400 | 店鋪已停用 |

---

## 3. 簡化預約

以電話識別用戶，自動用帳戶資料作聯絡人，即時扣積分並建立 `confirmed` 預約。

```http
POST /api/bot/booking
Content-Type: application/json
X-Bot-Key: <BOT_API_KEY>
```

### Request Body

| 欄位 | 必填 | 說明 |
|------|------|------|
| `phone` | ✅ | 預約用戶電話（用於搵帳戶同扣積分） |
| `court` | ✅ | 場地 `_id`（通常來自 availability 的 `courtId`） |
| `date` | ✅ | `YYYY-MM-DD` |
| `startTime` | ✅ | `HH:MM` |
| `endTime` | ✅ | `HH:MM` 或 `24:00` |
| `totalPlayers` | ✅ | 打球人數（1–8），**唔需要逐個玩家姓名** |
| `specialRequests` | ❌ | 特殊要求，最多 500 字 |
| `includeSoloCourt` | ❌ | 是否加租單人場（+100 積分），預設 `false` |
| `redeemCodeId` | ❌ | 兌換碼 ID |

### 關於 `players`（聯絡人）

與前台預約頁相同：

- **唔使傳 `players`**
- 系統自動用帳戶的 `name`、`email`、`phone` 寫入一筆聯絡人記錄
- 實際打球人數只用 `totalPlayers` 表示

### 請求示例

```json
{
  "phone": "91234567",
  "court": "665a1b2c3d4e5f6789012345",
  "date": "2026-07-10",
  "startTime": "18:00",
  "endTime": "20:00",
  "totalPlayers": 4,
  "specialRequests": "WhatsApp 預約",
  "includeSoloCourt": false
}
```

### 成功回應示例

```json
{
  "success": true,
  "data": {
    "message": "預約創建成功",
    "booking": {
      "_id": "...",
      "status": "confirmed",
      "date": "2026-07-10T00:00:00.000Z",
      "startTime": "18:00",
      "endTime": "20:00",
      "duration": 120,
      "totalPlayers": 4,
      "players": [
        { "name": "陳大文", "email": "user@example.com", "phone": "91234567" }
      ],
      "pricing": { "totalPrice": 400, "pointsDeducted": 400 },
      "payment": { "status": "paid", "method": "points", "pointsDeducted": 400 },
      "court": { "name": "1號場", "number": 1, "type": "competition" }
    },
    "user": {
      "id": "...",
      "name": "陳大文",
      "email": "user@example.com",
      "phone": "91234567",
      "membershipLevel": "basic"
    },
    "pointsDeducted": 400,
    "remainingBalance": 1100,
    "discount": "無折扣",
    "redeemCode": null
  }
}
```

若 `includeSoloCourt: true` 且成功，會多返 `soloCourtBooking` 同相應 `message`。

### 錯誤 code

| code | HTTP | 說明 |
|------|------|------|
| `USER_NOT_FOUND` | 404 | 電話對應唔到用戶 |
| `COURT_NOT_FOUND` | 404 | 場地不存在 |
| `COURT_UNAVAILABLE` | 400 | 場地維護中 |
| `COURT_CLOSED` | 400 | 非營業時段 |
| `PAST_DATE` | 400 | 過去日期 |
| `DATE_TOO_FAR` | 400 | 超出可預約天數上限 |
| `TIME_CONFLICT` | 400 | 時段已被預約 |
| `DURATION_TOO_SHORT` | 400 | 少於 1 小時 |
| `DURATION_TOO_LONG` | 400 | 超過 2 小時 |
| `INSUFFICIENT_BALANCE` | 400 | 積分不足 |
| `INVALID_TOTAL_PLAYERS` | 400 | `totalPlayers` 唔喺 1–8 |
| `INVALID_REDEEM_CODE` | 400 | 兌換碼無效或不適用 |
| `SOLO_COURT_NOT_FOUND` | 500 | 開啟單人場但搵唔到 solo 場地 |
| `SOLO_TIME_CONFLICT` | 400 | 單人場時段衝突 |

---

## n8n 建議流程

```
WhatsApp 收到訊息
    │
    ├─ 查積分 → GET /api/bot/balance?phone=...
    │
    ├─ 查空缺 → GET /api/stores（拎 storeId）
    │           → GET /api/bot/availability?store=...&date=...&startTime=...&endTime=...
    │
    └─ 預約   → POST /api/bot/booking（用 availability 返嘅 courtId）
```

### 輔助公開 API（唔使 Bot Key）

| API | 用途 |
|-----|------|
| `GET /api/stores` | 店鋪列表 |
| `GET /api/courts?store={id}` | 場地列表 |
| `GET /api/config/booking` | 可預約天數等設定 |

---

## 相關檔案

| 路徑 | 說明 |
|------|------|
| `server/routes/bot.js` | 路由 |
| `server/middleware/botAuth.js` | API Key 驗證 |
| `server/services/botUserService.js` | 電話查用戶／積分 |
| `server/services/botAvailabilityService.js` | 空缺查詢 |
| `server/services/botBookingService.js` | 預約建立 |
| `server/utils/phoneUtils.js` | 電話正規化 |
