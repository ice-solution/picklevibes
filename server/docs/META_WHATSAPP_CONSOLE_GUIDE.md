# Meta Developers／WhatsApp Manager 填寫指南（PickCourt）

App Status = **Live / 已發佈** 之後，按下面順序填。

---

## A. Meta Developers → 你的 App

路徑：https://developers.facebook.com/apps → 選 PickCourt App

### 1) 設定 → 基本（Settings → Basic）

| 欄位 | 建議填寫 |
|------|----------|
| 應用程式顯示名稱 | PickCourt |
| 應用程式網域 | `pickcourt.hk`（或你正式域名，唔好加 https://） |
| 私隱政策網址 | `https://pickcourt.hk/privacy`（必須可開） |
| 服務條款網址 | `https://pickcourt.hk/terms`（必須可開） |
| 應用程式圖示 | PickCourt logo |
| 類別 | 商業 / Business |
| 聯絡電郵 | 你公司電郵 |

儲存後，確認頂部係 **Live**（已發佈）。

### 2) 新增產品（若未加）

左側 **新增產品** → 搵 **WhatsApp** → 設定。

### 3) WhatsApp → API 設定（API Setup）／步驟 1：嘗試看看

新版介面未必有「API Setup」字樣，通常在：

**使用案例 →「透過 WhatsApp 與顧客建立聯繫」→ 自訂 → 步驟 1：嘗試看看**

記下（之後入 `.env`）：

| 項目 | 對應 env | 注意 |
|------|----------|------|
| **Phone number ID** | `META_WA_PHONE_NUMBER_ID` | 寄件號碼下面嗰串數字，**唔係** WABA ID |
| **WhatsApp Business Account ID** | `META_WA_WABA_ID`（可選） | 帳戶層級 ID，**唔好**填入 Phone Number ID |
| 臨時 token | 只用作測試 | **唔好**用喺 production |

正式發送請用下方 **System User 永久 token**。

> 常見搞錯：把 WABA ID（例如帳戶列表的 ID）填入 `META_WA_PHONE_NUMBER_ID`，會導致 `/media` 上傳報 `Unsupported post request`。

### 4) 商業設定 → 系統使用者（永久 Token）

1. 打開 [Meta Business Suite → 商業設定](https://business.facebook.com/settings)
2. **使用者** → **系統使用者** → 新增（名稱例如 `pickcourt-wa`，角色 Admin）
3. **新增資產** → 勾選你的 App + WhatsApp 帳戶
4. **產生新權杖** → 選 App → 權限至少：
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. 複製 token → `.env` 的 `META_WA_TOKEN`

---

## B. 建立 Message Templates

路徑二選一：

- Developers App → **WhatsApp** → **訊息範本**／**Message templates**  
- 或 [WhatsApp Manager](https://business.facebook.com/wa/manage/message-templates/) → 選你的 WABA → **建立範本**

語言請選 **Chinese (HK) / 中文（香港）**，code = `zh_HK`（須同 `META_WA_TEMPLATE_LANG=zh_HK` 一致）。  
若介面無 zh_HK，改用 **zh_TW**，同時把 env 改成 `META_WA_TEMPLATE_LANG=zh_TW`。

類別一律選：**Utility（公用事業／交易）** — 預約／進場通知。

---

### 模板 1：無門禁預約確認

| 欄位 | 填寫 |
|------|------|
| 範本名稱（Name） | `pickcourt_booking_confirm`（小寫＋底線，建立後不能改） |
| 類別 | **Utility** |
| 語言 | **zh_HK**（或 zh_TW） |
| Header | **無** |
| Footer | 可選：`PickCourt` |
| Buttons | 無（第一版） |

**Body（完整複製）：**

```
您好，您的預約已確認。

店鋪：{{1}}
日期：{{2}}
時段：{{3}}
場地：{{4}}
地址：{{5}}

請準時到場。如有疑問請回覆此訊息。
```

建立時系統會要求為每個 `{{n}}` 填 **範例值**（審批用），建議：

| 變數 | 範例 |
|------|------|
| {{1}} | 荔枝角 PickleVibes |
| {{2}} | 2026年7月30日（四） |
| {{3}} | 19:00–20:00 |
| {{4}} | 1號場 |
| {{5}} | 荔枝角福源廣場 |

提交 → 等 **Approved / 已核准**。

---

### 模板 2：有門禁（QR + 密碼）

| 欄位 | 填寫 |
|------|------|
| 範本名稱 | `pickcourt_access_code` |
| 類別 | **Utility** |
| 語言 | 同模板 1 |
| Header | **Image（圖片）** ← 必選，程式會動態上傳 QR |
| Footer | 可選：`PickCourt` |
| Buttons | 無 |

審批時 Header 要上傳一張 **樣本圖**（任意 QR PNG／場地圖都可以，只係審批樣板）。

**Body（完整複製）：**

```
您好，以下是您的進場資料。

店鋪：{{1}}
日期：{{2}}
時段：{{3}}
場地：{{4}}
進場密碼：{{5}}

請用上方 QR Code 或密碼於時段內進場。
```

範例值：

| 變數 | 範例 |
|------|------|
| {{1}} | 荔枝角 PickleVibes |
| {{2}} | 2026年7月30日（四） |
| {{3}} | 19:00–20:00 |
| {{4}} | 1號場 |
| {{5}} | 123456 |

提交 → 等 **Approved**。

---

## C. `.env` 對照（核准後）

```bash
META_WA_ENABLED=1
META_WA_TOKEN=（System User 永久 token）
META_WA_PHONE_NUMBER_ID=（API Setup 的 Phone number ID）
META_WA_API_VERSION=v21.0
META_WA_TEMPLATE_BOOKING=pickcourt_booking_confirm
META_WA_TEMPLATE_ACCESS=pickcourt_access_code
META_WA_TEMPLATE_LANG=zh_HK
```

名稱、語言 code 必須同後台 **完全一致**（大小寫都要對）。

---

## D. 常見卡住

| 情況 | 處理 |
|------|------|
| 模板被拒 | Utility 內唔好加推廣字眼（優惠、折扣、邀請朋友）；保持交易通知語氣 |
| 只有測試號可收 | 正式號要 Connected；測試期收件人要加入允許名單 |
| Header IMAGE 審批 | 必須上傳樣本圖；Live 發送時由系統上傳真 QR |
| App Live 但仍唔得 | 檢查 System User 有冇綁 WABA + 權限、token 未過期 |

---

## E. 你填完可以回覆我

1. 兩個模板係 **Pending** 定 **Approved**？  
2. 語言係 `zh_HK` 定 `zh_TW`？  
3. Phone number ID 已未抄低？（唔使貼 token 到 chat）

Approved 之後再喺 `.env` 加 data 重啟即可測預約發送。
