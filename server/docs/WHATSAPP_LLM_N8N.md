# WhatsApp LLM 自動回覆＋訂場（Meta Cloud + n8n）

## 架構

```
用戶 WhatsApp
  → Meta Cloud Webhook
  → n8n（或 picklevibes 收後轉發 n8n）
  → OpenAI tool-calling
  → PickleVibes Bot API
  → Meta Graph 文字回覆
```

兩種 webhook 接法（二揀一）：

| 模式 | Meta Callback URL | 說明 |
|------|-------------------|------|
| **A（建議 MVP）** | n8n Production Webhook | Meta 直入 n8n |
| **B** | `https://<api>/api/whatsapp/webhook` | Server 驗簽／記 status，inbound 轉發 `WHATSAPP_N8N_FORWARD_URL` |

## 1. 環境變數

### picklevibes `.env`

```env
BOT_API_KEY=你的長隨機字串

# WhatsApp Cloud（出站 template／文字）
WHATSAPP_CLOUD_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v21.0

# Webhook（模式 B 或共用 verify token）
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=picklevibes_whatsapp_verify_xxx
WHATSAPP_WEBHOOK_LOG_INBOUND=1

# 模式 B：轉發 inbound 去 n8n
WHATSAPP_N8N_FORWARD_URL=https://<n8n>/webhook/whatsapp-llm
```

### n8n 環境變數

```env
WHATSAPP_CLOUD_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=picklevibes_whatsapp_verify_xxx

BOT_API_BASE_URL=https://picklevibes.hk
BOT_API_KEY=

OPENAI_API_KEY=
# OpenRouter 例子：
# OPENAI_BASE_URL=https://openrouter.ai/api/v1
# OPENAI_MODEL=deepseek/deepseek-chat
# OPENAI_FALLBACK_MODELS=deepseek/deepseek-v3.2,openai/gpt-4o-mini
OPENAI_MODEL=deepseek/deepseek-chat
OPENAI_FALLBACK_MODELS=deepseek/deepseek-v3.2,openai/gpt-4o-mini
# OPENAI_BASE_URL=https://api.openai.com/v1

PICKLEVIBES_REGISTER_URL=https://picklevibes.hk
```

LLM 呼叫若遇 `429`／`5xx`：同一模型會重試一次；仍失敗則依 `OPENAI_FALLBACK_MODELS` 自動換下一個模型。用戶只會收到正常回覆；全部失敗先顯示「系統暫時忙碌…」同官方電話。

## 2. Echo 逐步教學（你而家呢一步）

目標：證明「Meta ↔ n8n ↔ WhatsApp 回覆」通晒。**暫時唔使理 LLM／訂場。**

檔案：[`n8n/workflows/01-whatsapp-meta-echo.json`](../../n8n/workflows/01-whatsapp-meta-echo.json)

### 2.1 匯入之後，畫布上有咩？（唔使改節點邏輯）

| 節點 | 做咩 | 你要唔要改？ |
|------|------|-------------|
| **Webhook GET Verify** | Meta 驗證 webhook 時用（GET） | 唔使改 path（已係 `whatsapp-cloud`） |
| **IF Verify OK** | 核對 verify token | 唔使改（讀 `$env.WHATSAPP_WEBHOOK_VERIFY_TOKEN`） |
| **Respond Challenge / 403** | 驗證成功／失敗回覆 | 唔使改 |
| **Webhook POST Messages** | 收到用戶訊息（POST） | 唔使改 |
| **Respond 200 ASAP** | 即刻回 200 畀 Meta | 唔使改 |
| **Parse + Dedupe** | 抽出文字、防重覆 | 唔使改 |
| **Send Echo via Cloud API** | 用 Meta Graph 把訊息 echo 返去 | **靠下面 3 個 n8n 環境變數** |

唔使喺每個 HTTP 節點人手貼 Token——workflow 用 `$env.XXX`。

### 2.2 先喺 n8n 設環境變數（最容易漏）

Echo **只需要 4 個**（LLM 嗰套稍後先加）：

| 變數名 | 填咩 | 去邊度抄 |
|--------|------|----------|
| `WHATSAPP_CLOUD_TOKEN` | Meta 永久／System User access token | Meta App → WhatsApp → API Setup → Access token（或你 picklevibes `.env` 嘅 `WHATSAPP_CLOUD_TOKEN`） |
| `WHATSAPP_PHONE_NUMBER_ID` | 商業號嘅 Phone number ID（一串數字） | 同上頁 Phone number ID（或 `.env` 嘅 `WHATSAPP_PHONE_NUMBER_ID`） |
| `WHATSAPP_API_VERSION` | 例如 `v21.0` | 可照填 `v21.0` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | **你自己發明**嘅字串，例如 `picklevibes_wa_verify_2026` | 隨便定；稍後 Meta Console 要填**同一個** |

**點樣加進 n8n（你用緊自架 `n8n.picklevibes.hk`）：**

呢個 Echo workflow 表達式寫嘅係 `$env.XXX`，即係讀 **跑 n8n 嗰部機／容器嘅系統環境變數**，**唔係** workflow 畫布入面某個節點設定。

#### 做法 A（對應 `$env`，推薦自架）

喺 **跑 n8n 嘅伺服器** 加 env，然後 **重啟 n8n**：

- **Docker Compose**：編輯 `docker-compose.yml` 嘅 `environment:` 或同目錄 `.env`，例如：

```yaml
environment:
  - WHATSAPP_CLOUD_TOKEN=EAAxxxx
  - WHATSAPP_PHONE_NUMBER_ID=123456789
  - WHATSAPP_API_VERSION=v21.0
  - WHATSAPP_WEBHOOK_VERIFY_TOKEN=picklevibes_wa_verify_2026
```

然後：`docker compose up -d`（或你平時重啟 n8n 嘅指令）

- **只用 `.env` 檔啟動**：喺 n8n 啟動目錄嘅 `.env` 加同上幾行，重啟 process  
- **systemd**：喺 service 嘅 `Environment=` / `EnvironmentFile=` 加，然後 `systemctl restart n8n`

加完要重啟先生效。畫布上 **唔會** 出現一個「填 Token」嘅表格——呢點好易誤會。

#### 做法 B（n8n 介面 Variables → `$vars`）

有啲人會去：

**左下／左邊選單 → Settings（齒輪）→ Variables → Add variable**

呢度加嘅係 `$vars.名`，**唔等同** `$env.名`。  
若你只係喺呢度加、workflow 仍然寫 `$env.XXX`，Verify 會失敗。  
要用介面 Variables，就要改 workflow 表達式做 `$vars.WHATSAPP_WEBHOOK_VERIFY_TOKEN` 等（或問我幫你改 JSON）。

> 總結：自架 + 而家呢份 Echo JSON → 用 **做法 A（伺服器 env + 重啟）**。

### 2.3 開 workflow、拎 Webhook URL

1. 打開 **PickleVibes WA Echo (Meta Cloud)**  
2. 右上角 **Inactive → Active**（一定要 Active，Production URL 先有效）  
3. 撳 **Webhook GET Verify** 或 **Webhook POST Messages** 其中一個  
4. 面板會顯示 URL，類似：

```text
https://你的n8n網域/webhook/whatsapp-cloud
```

（Test URL 會有 `/webhook-test/`——**畀 Meta 用要 Production**：`/webhook/`，唔好用 test。）

GET 同 POST 共用同一個 path `whatsapp-cloud`，所以 **Callback URL 只填一條**：

```text
https://你的n8n網域/webhook/whatsapp-cloud
```

### 2.4 去 Meta 貼呢條 URL

1. [Meta for Developers](https://developers.facebook.com/) → 你嘅 App  
2. **WhatsApp → Configuration**（或 API Setup 頁嘅 Webhook）  
3. **Edit** Callback URL：  
   - **Callback URL** = 上面嗰條 `.../webhook/whatsapp-cloud`  
   - **Verify token** = 同 n8n 嘅 `WHATSAPP_WEBHOOK_VERIFY_TOKEN` **完全一樣**  
4. **Verify and save**  
   - 成功：Meta 會 GET 你 n8n，n8n 回 challenge  
   - 失敗：多數係 workflow 未 Active、URL 錯、或 verify token 唔一致  
5. Subscribe 欄位勾 **messages** → Save

### 2.5 用手機試

1. 用你嘅 WhatsApp 發訊息去**已接好 Cloud API 嘅商業號**（測試號或正式號）  
2. 內容寫 `hello`  
3. 應收到回覆：`Echo: hello`  
4. 同時 n8n → **Executions** 應見到一筆成功執行  

若收唔到：

| 現象 | 常見原因 |
|------|----------|
| Meta Verify 失敗 | workflow 未 Active／verify token 唔同／URL 用咗 webhook-test |
| Meta 成功但無 echo | `WHATSAPP_CLOUD_TOKEN` 或 `PHONE_NUMBER_ID` 錯／過期 |
| Executions 有錯紅色 | 打開該次 execution，睇 **Send Echo** 節點錯誤（多數係 token） |
| 完全無 execution | Callback URL 未指到呢個 workflow，或未 subscribe `messages` |

### 2.6 Echo 通咗之後先做 LLM

1. **Deactivate** Echo workflow（同一個 Meta App 只能一個 Callback URL；唔好兩套搶）  
2. Import [`02-whatsapp-llm-booking.json`](../../n8n/workflows/02-whatsapp-llm-booking.json)  
3. 再加 n8n env：`BOT_API_BASE_URL`、`BOT_API_KEY`、`OPENAI_API_KEY`（同埋可選 `OPENAI_MODEL`）  
4. Activate LLM workflow；Meta Callback 改成：

```text
https://你的n8n網域/webhook/whatsapp-llm
```

（verify token 可以唔改，繼續用同一個。）

---

## 3. 模式 B（可選）：Webhook 先入 picklevibes server

若想 Meta 指去 `https://api.xxx/api/whatsapp/webhook`，再轉發 n8n：

1. picklevibes `.env` 設 `WHATSAPP_APP_SECRET`、`WHATSAPP_WEBHOOK_VERIFY_TOKEN`、`WHATSAPP_N8N_FORWARD_URL`  
2. Meta Callback = server URL  
3. Forward URL 指去 n8n 嘅 `.../webhook/whatsapp-llm`  

MVP 建議用 **模式 A（直入 n8n）**，少一跳。

## 5. Bot API（LLM tools）

| Tool | API |
|------|-----|
| get_balance | `GET /api/bot/balance?phone=` |
| get_stores | `GET /api/bot/stores`（含地址＋別名，例如尖沙咀／iSQUARE） |
| resolve_store | `GET /api/bot/stores/resolve?q=`（店名／地址／別名） |
| list_activities | `GET /api/bot/activities?store=&limit=` |
| check_availability | `GET /api/bot/availability?...` |
| create_booking | `POST /api/bot/booking`（`source=whatsapp_bot`） |

詳見 [`BOT_API.md`](./BOT_API.md)。System prompt：[`n8n/prompts/system-prompt.md`](../../n8n/prompts/system-prompt.md)。

## 6. 安全規則（已寫入 workflow）

- message.id 去重（防 Meta 重送雙重扣款）
- 訂場前 `propose_booking`；只有用戶回「確認」先 `create_booking`
- 價錢／空位只信 Bot API
- 24h 服務視窗內用 free-form text；逾時要用 template

## 7. UAT

跑：

```bash
BOT_API_BASE_URL=http://127.0.0.1:5001 \
BOT_API_KEY=xxx \
UAT_PHONE=91234567 \
node server/scripts/uatWhatsappBotFlow.js
```

清單見腳本輸出同 [`features/whatsapp-llm-n8n.md`](../../features/whatsapp-llm-n8n.md)。
