# WhatsApp LLM 自動回覆＋訂場（Meta Cloud + n8n）

## 狀態

✅ Server／Bot API／n8n workflow／文件已落地。  
餘下：喺 Meta Console 同 n8n 實機接線（見設定文件）。

## 文件

- 主設定：[`server/docs/WHATSAPP_LLM_N8N.md`](../server/docs/WHATSAPP_LLM_N8N.md)
- Bot API：[`server/docs/BOT_API.md`](../server/docs/BOT_API.md)
- System prompt：[`n8n/prompts/system-prompt.md`](../n8n/prompts/system-prompt.md)

## 可匯入 workflows

| 檔案 | 用途 |
|------|------|
| `n8n/workflows/01-whatsapp-meta-echo.json` | Meta verify + echo |
| `n8n/workflows/02-whatsapp-llm-booking.json` | LLM + Bot tools + 確認閘 + 去重 |

## Server 新增／改動

- `GET /api/bot/stores`、`GET /api/bot/stores/resolve`
- `POST /api/bot/booking` 支援 `source`（預設 `whatsapp_bot`）
- `Booking.source` 欄位
- `GET|POST /api/whatsapp/webhook`（驗簽、status log、可轉發 n8n）
- `whatsappCloudService.sendTextMessage`

## UAT

```bash
BOT_API_BASE_URL=http://127.0.0.1:5001 \
BOT_API_KEY=xxx \
UAT_PHONE=91234567 \
node server/scripts/uatWhatsappBotFlow.js
```

WhatsApp 端 checklist 見腳本輸出。
