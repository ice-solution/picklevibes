# Meta WhatsApp Cloud API（PickCourt 共用一號）

PickCourt 使用 **一個** Meta WhatsApp Business 號碼，代全部聯盟店鋪發送預約／進場通知。

## 行為

| 店鋪類型 | 發送內容 |
|---------|---------|
| **有門禁**（HIK／大華） | 模板 `pickcourt_access_code`：Header QR 圖 + 店名／日期／時段／場地／密碼 |
| **無門禁** | 模板 `pickcourt_booking_confirm`：店名／日期／時段／場地／地址 |

觸發時機：預約成功、後台重發通知（與電郵並行；WhatsApp 失敗不阻斷預約）。

## 環境變數

```bash
BOOKING_WA_PROVIDER=meta         # meta = WhatsApp Cloud API（預設）；openwa = legacy
META_WA_ENABLED=1
META_WA_TOKEN=...                 # System User 永久 token
META_WA_PHONE_NUMBER_ID=...      # 發送號碼的 Phone number ID
META_WA_API_VERSION=v21.0
META_WA_TEMPLATE_BOOKING=pickcourt_booking_confirm
META_WA_TEMPLATE_ACCESS=pickcourt_access_code
META_WA_TEMPLATE_CANCEL=pickcourt_booking_cancel
META_WA_TEMPLATE_LANG=zh_HK      # 或 zh_TW / en 等，須與模板語言一致
```

啟用 `META_WA_ENABLED=1`（或 `BOOKING_WA_PROVIDER=meta`）後，預約建立／取消會走 **Meta Cloud API**，唔會再走 OpenWA／Twilio（避免雙重發送）。
若仍要暫用 OpenWA，設 `BOOKING_WA_PROVIDER=openwa`。

## 請在 Meta 申請的模板

### 1) `pickcourt_booking_confirm`（Utility）

Body 變數：

1. 店鋪名稱  
2. 日期  
3. 時段  
4. 場地名稱  
5. 地址  

範例：

```
您好，您的預約已確認。

店鋪：{{1}}
日期：{{2}}
時段：{{3}}
場地：{{4}}
地址：{{5}}

請準時到場。如有疑問請回覆此訊息。
— PickCourt
```

### 2) `pickcourt_access_code`（Utility）

- **Header**：Image（動態上傳進場 QR）  
- Body 變數：

1. 店鋪名稱  
2. 日期  
3. 時段  
4. 場地名稱  
5. 進場密碼  

範例：

```
您好，以下是您的進場資料。

店鋪：{{1}}
日期：{{2}}
時段：{{3}}
場地：{{4}}
進場密碼：{{5}}

請用上方 QR Code 或密碼於時段內進場。
— PickCourt
```

### 3) `pickcourt_booking_cancel`（Utility）

Body 變數：

1. 店鋪名稱  
2. 日期  
3. 時段  
4. 場地名稱  

範例：

```
您好，您的預約已取消。

店鋪：{{1}}
日期：{{2}}
時段：{{3}}
場地：{{4}}

如有疑問請回覆此訊息。
— PickCourt
```

## Meta 後台檢查清單

1. Meta App → WhatsApp → API Setup：取得 Phone number ID  
2. Business Settings → System users：產生永久 token（`whatsapp_business_messaging`）  
3. WhatsApp Manager → 建立並通過上述兩個模板  
4. 測試號白名單（開發期）或正式號 Connected  
5. 將 env 填入 UAT／Production 後重啟 server  

## 電話格式

系統會把香港 8 位手機自動加 `852`。用戶／預約聯絡人需有有效手機號。

## 相關程式

- `server/services/metaWhatsAppService.js`
- `server/services/bookingNotificationService.js`
