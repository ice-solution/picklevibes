# Game Client 整合流程（PickleVibes）

此文件描述遊戲端（Game Client）如何與 PickleVibes 後端/前端整合，包含：
- 產生 session + QR code
- Web 掃碼登入並綁定 session
- 遊戲端收到綁定成功通知並開始遊戲
- 提交結果、推送結果、取得排行榜

> 本文件以 UAT/Prod 共用邏輯描述，請自行切換 base URL。

---

## 必要環境變數（Server）

Server `.env` / 部署環境變數需設定：

- `GAME_JWT_SECRET`：遊戲端 JWT 驗證 secret（**必須**，不要與 `JWT_SECRET` 共用）
- `GAME_QR_SECRET`：QR payload 簽名 secret（**必須**）
- （已改為後台 DB 管理多個 game clients，不再需要 `GAME_CLIENT_ID` / `GAME_CLIENT_SECRET`）

---

## 名詞

- **GameHall**：遊戲廳（Mongo `_id`），由後台建立後派發給遊戲端
- **GameSession**：一次登入綁定流程的 session（Mongo `_id`），會過期（TTL）
- **socketCode**：遊戲端用作開房間/配對的代碼（由 `/info` 回傳）
- **sig**：HMAC 簽名（防止 QR payload 被竄改）

---

## 整合流程（整體）

### Step 1：遊戲端取得 session + QR

#### API
`GET /api/games/:gameHallId/info`

#### Auth
Header：`Authorization: Bearer <GAME_JWT>`

#### Response（重點）
- `data.session._id`：sessionId
- `data.session.socketCode`：socketCode（開房間用）
- `data.qr.imageUrl`：QR 圖片 URL（PNG）
- `data.qr.joinUrl`：Web join URL（已包含 `sig` + `code`）

#### 遊戲端要做
- 顯示 QR（用 `qr.imageUrl`）
- 用 `socketCode` 建立房間（或顯示給遊戲畫面）

---

### Step 2：遊戲端接 Socket.IO，等用戶綁定成功

#### 連線
連到同一個 server host（例：`https://uat.picklevibes.hk`）

#### 註冊加入遊戲廳 room
connect 後 emit：

- event：`game:register`
- payload：`{ token: "<GAME_JWT>", gameHallId: "<gameHallId>" }`

成功會收到：
- event：`game:registered`
- payload：`{ ok: true, gameHallId }`

當用戶完成掃碼 join（Step 3）後，遊戲端會收到：
- event：`session:bound`
- payload：`{ sessionId, userId, username }`

同時會收到（可用作遊戲中動態設定）：
- event：`session:setting`
- payload：`{ sessionId, settings: { displayName: boolean } }`

> 遊戲端收到 `session:bound` 後，即可把該 `userId` 綁到該房間（可用 `socketCode` 作 mapping）。

---

### Step 3：用戶掃碼 → 開啟 Web join → 登入 → 綁定 session

用戶掃 QR 後會打開：

`/game/join/:sessionId?sig=...&code=...`

- 需要登入（未登入會導向 login；登入後回來 join 頁）
- join 頁會呼叫：
  `POST /api/games/sessions/:sessionId/join`
  body：`{ sig, code }`

Server 綁定成功後會 socket 通知遊戲端：
- `session:bound`（發到 `gameHall:<gameHallId>` room）

---

### Step 4：遊戲端開始遊戲（由遊戲端控制）

修正版：**用戶完成 Step 3 綁定後，會在手機端按「開始遊戲」**，Server 會通知遊戲端正式開局。

#### 手機端（Web）按開始
Join 頁會呼叫：
`POST /api/games/sessions/:sessionId/start`

Server 成功後會 socket 通知遊戲端：
- event：`session:started`（發到 `gameHall:<gameHallId>` room）
- payload：`{ sessionId, userId }`

---

### Step 5：遊戲完成 → 遊戲端提交結果

#### API
`POST /api/games/sessions/:sessionId/result`

#### Auth
Header：`Authorization: Bearer <GAME_JWT>`

#### Body（最小）
```json
{
  "userId": "mongo_user_id",
  "scores": 123,
  "hitRate": 0.87,
  "hitAccuracy": 0.92,
  "maxCombo": 25,
  "history": [
    { "time": 0.00, "x": 11, "y": 12 }
  ]
}
```

#### Server 行為
- 存入 match（含 `history`）
- 更新 leaderboard（以 `gameHallId + seasonKey` 一期累積）
- 推送結果到 web 用戶端：
  - event：`game:result`（發到 `user:<userId>` room）

---

### Step 6：取得排行榜

#### API
`GET /api/games/:gameHallId/leaderboard?limit=20`

#### Response（重點）
回每個用戶：
- `name`
- `totalScore`
- `matches`
- `lastMatchAt`

---

## 失敗/錯誤情境（Game Client 需處理）

- **401**：GAME JWT 無效或缺少（`/info`、`/result`）
- **403**：QR sig 驗證失敗（QR 圖片/ join）
- **400**：session 已過期、socketCode 不匹配
- **404**：gameHall/session 不存在

---

## Game JWT 建議格式（由你簽發）

你可以透過後端 API（管理員）簽發 Game JWT，方便 game client 自動更新 token。

### Game Client Login API（建議做法）
`POST /api/game-auth/login`

Body：
```json
{
  "clientId": "game-client-1",
  "clientSecret": "********",
  "expiresInDays": 30
}
```

回傳：
```json
{
  "data": {
    "token": "<GAME_JWT>",
    "expiresAt": "..."
  }
}
```

---

## 後台建立/管理 Game Client（管理員）

### 建立（會回傳一次性 secret）
`POST /api/game-clients`

Body：
```json
{
  "clientId": "tv-01",
  "name": "灣仔店大電視",
  "isActive": true
}
```

回傳（重點）：
```json
{
  "data": {
    "item": { "_id": "...", "clientId": "tv-01" },
    "clientSecret": "一次性顯示，請保存"
  }
}
```

### 重置 secret（會回傳一次性新 secret）
`POST /api/game-clients/:id/reset-secret`

### 簽發 API（admin only）
`POST /api/game-auth/token`

Body（可選）：
```json
{
  "clientId": "game-client-1",
  "expiresInDays": 30
}
```

回傳：
```json
{
  "data": {
    "token": "<GAME_JWT>",
    "expiresAt": "..."
  }
}
```

建議 JWT payload：
```json
{
  "iss": "picklevibes",
  "aud": "game-client",
  "sub": "game-client-1",
  "iat": 1234567890,
  "exp": 1234567890
}
```

