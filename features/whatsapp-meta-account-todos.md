# WhatsApp Meta 帳號待辦（非程式碼）

程式 deploy 之外，Meta / WhatsApp Manager 後台仍有項目可提升 **message limit** 同 **穩定性**。  
上次 API `health_status` 查詢時（billing 卡已加）仍見：

| 項目 | 當時狀態 | 影響 |
|------|----------|------|
| WABA send | `AVAILABLE` | ✅ business initiated 已解鎖 |
| Overall | `LIMITED` | message limit 受限制 |
| `name_status` | `NON_EXISTS` | Display name 未批 |
| `code_verification_status` | `EXPIRED` | 電話 OTP 驗證過期 |
| App webhook | 未 subscribe | 收唔到 status（見 [whatsapp-delivery-webhook.md](./whatsapp-delivery-webhook.md)） |

> 若已成功 cold send，以下為 **優化**，唔阻塞基本功能。

---

## 1. Display Name 審批

**路徑：** WhatsApp Manager → Phone numbers → `+852 5499 2926` → Display name

- 提交正式品牌名（例如 `PickleVibes`），唔好用 placeholder `Picklevibes new phone`
- 等 `name_status` → `APPROVED` 或 `AVAILABLE_WITHOUT_REVIEW`
- 批咗之後 daily message limit 會上升

---

## 2. 電話 OTP Re-verify

**路徑：** 同上 → Verify number

- `code_verification_status` 應為 `VERIFIED`
- 用 SMS 或 voice 收 OTP

---

## 3. System User Token 權限

**路徑：** Business Settings → Users → System users

- Token scopes：`whatsapp_business_messaging`, `whatsapp_business_management`
- Assign assets：
  - WABA `Picklevibes CS` — Full control
  - Phone `+852 5499 2926` — Full control
- 用 **永久** System User token 放 `WHATSAPP_CLOUD_TOKEN`（唔好用短期 user token）

---

## 4. Billing

- WABA 已绑有效 payment method（141006 已解决 ✅）
- 定期檢查 card 唔好 expired

---

## 5. Template 維護

| Template | Category | 用途 |
|----------|----------|------|
| `booking_confirmed` | UTILITY | 預約確認 |
| `booking_access` | UTILITY | 進場 / 密碼 |
| `booking_cancelled` | UTILITY | 取消 |
| `coach_class_*` | UTILITY | 教練課 |
| `overnight_new_booking` | UTILITY | 通宵新單 |
| `overnight_ac_summary` | MARKETING | 加冷氣匯總（注意 marketing 限制） |
| `application_notify` | UTILITY | 申請表通知 |

- 改 template 文案後要 re-submit 審批  
- 改名要同步 `server/config/whatsappTemplates.js` 同 env override

---

## 驗證指令（local，需 `.env` token）

```bash
curl -s "https://graph.facebook.com/v21.0/1217396424783150?fields=health_status,code_verification_status,name_status,quality_rating" \
  -H "Authorization: Bearer $WHATSAPP_CLOUD_TOKEN" | python3 -m json.tool
```

期望：

- `health_status.can_send_message` → `AVAILABLE`（或至少 WABA entity 为 `AVAILABLE`）
- `code_verification_status` → `VERIFIED`
- `name_status` → `APPROVED`
