# WhatsApp Sandbox 設置指南

## 問題說明
錯誤 `Twilio could not find a Channel with the specified From address` 表示 WhatsApp Sandbox 沒有正確設置。

## 解決步驟

### 1. 設置 WhatsApp Sandbox

1. **訪問 Twilio Console**
   - 登入 [Twilio Console](https://console.twilio.com/)
   - 導航到 [WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)

2. **啟用 WhatsApp Sandbox**
   - 點擊 "Try it out" 或 "Get started"
   - 按照指示完成設置

3. **獲取 Sandbox 號碼**
   - 完成設置後，您會獲得一個專用的 Sandbox 號碼
   - 格式通常為：`whatsapp:+14155238886` 或類似的號碼

### 2. 更新環境變量

在 `.env` 文件中設置：

```env
# Twilio 基本配置
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_actual_auth_token_here

# WhatsApp Sandbox 配置
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

**注意**：
- 將 `+14155238886` 替換為您實際獲得的 Sandbox 號碼
- 確保號碼格式包含 `whatsapp:` 前綴

### 3. 測試設置

使用以下 API 檢查配置：

```bash
# 檢查配置
GET /api/whatsapp/config

# 發送測試訊息
POST /api/whatsapp/send
{
  "to": "+85212345678",
  "message": "測試訊息"
}
```

### 4. 常見問題

**問題 1：Sandbox 未啟用**
- 解決：確保在 Twilio Console 中完成了 WhatsApp Sandbox 設置

**問題 2：號碼格式錯誤**
- 解決：確保 `TWILIO_WHATSAPP_FROM` 以 `whatsapp:` 開頭

**問題 3：權限不足**
- 解決：確保 Twilio 帳戶有 WhatsApp 權限

### 5. 生產環境設置

當準備部署到生產環境時：

1. **申請 WhatsApp Business API**
   - 在 Twilio Console 中申請 WhatsApp Business API
   - 完成驗證流程

2. **更新 From 號碼**
   - 使用您的 WhatsApp Business 號碼
   - 格式：`whatsapp:+1234567890`

## 測試號碼

在 Sandbox 模式下，您只能向已加入 Sandbox 的號碼發送訊息：

1. 發送 `join <sandbox-keyword>` 到您的 Sandbox 號碼
2. 收到確認後，該號碼就可以接收 WhatsApp 訊息

## 支援

如果仍有問題，請檢查：
- Twilio Console 中的 WhatsApp 設置
- 帳戶權限和限制
- 網路連接和防火牆設置

