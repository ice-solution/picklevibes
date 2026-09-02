# Features（待實作 / 待 Deploy）

此資料夾存放 **尚未實作** 的功能規劃，方便之後有空再分批 deploy。  
每個 `.md` 自成一項，包含背景、實作步驟、env 變數同測試清單。

## 清單

| 文件 | 摘要 | 優先級 |
|------|------|--------|
| [whatsapp-delivery-webhook.md](./whatsapp-delivery-webhook.md) | Meta WhatsApp 訊息狀態 webhook（`delivered` / `failed` / `read`） | 高 |
| [whatsapp-meta-account-todos.md](./whatsapp-meta-account-todos.md) | Meta 後台帳號設定（Display Name、OTP 重驗等） | 中 |
| [whatsapp-booking-page-notice.md](./whatsapp-booking-page-notice.md) | 訂場成功頁 WhatsApp 提示文案（可選 UX） | 低 |
| [athlete-role.md](./athlete-role.md) | 選手 role（21 日訂場、VIP 8 折、收款連結半價） | ✅ 已實作 |

## 相關已存在程式（WhatsApp Cloud）

- `server/services/whatsappCloudService.js` — Graph API send
- `server/services/whatsappMessagingService.js` — 統一入口（cloud / openwa）
- `server/config/whatsappTemplates.js` — template 名稱
- `env.example` — `WHATSAPP_*` 變數

## 使用方式

1. 揀一個 `.md` 跟步驟實作  
2. 完成後可刪除或將該項標記為 ✅（在 README 加一欄「狀態」）  
3. 勿在此 folder 放 secrets；只記 env **變數名稱**
