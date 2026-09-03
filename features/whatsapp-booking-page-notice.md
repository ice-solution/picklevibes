# 訂場成功頁 — WhatsApp 提示（可選 UX）

## 背景

WhatsApp Business template 訊息：

- **唔需要** user 先 hi（Utility template + WABA 正常時）
- 會喺 user WhatsApp **Chats** 出現新對話（唔係人人都有「Updates」分頁）
- 若 user block 咗 business number 或電話錯，就收唔到

加一句簡短提示可減少「我以為冇通知」嘅 support 查詢。

---

## 建議文案（繁中）

> 預約確認及進場資訊將透過 WhatsApp 發送至您登記的電話號碼（+852 …）。  
> 請留意來自 **PickleVibes** 的 WhatsApp 訊息。

可選第二行（若仍想引導互動）：

> 如未收到，請確認號碼正確，並檢查是否封鎖未知商業帳號。

**唔建議** 写「請先 send hi」— 在 billing / WABA 正常後唔再需要。

---

## 實作位置（待查）

可能页面：

- 訂場成功 / 確認页（client booking flow）
- 「我的預約」详情页 — 显示「已发送 WhatsApp 通知」状态（需 backend 记录 send result）

实现时可 search：

```
booking success / 預約成功 / bookingNotification
```

相关 service：`server/services/bookingNotificationService.js`

---

## 进阶（可选，非必须）

1. **Send 结果展示**  
   - API 返回 `{ whatsapp: { sent: true, messageId } }`  
   - 前端显示「WhatsApp 已发送」或「发送失败，请查看 SMS/Email」

2. **Click-to-chat 备用链接**（仅当 send fail）  
   ```
   https://wa.me/85254992926?text=我已預約，請協助確認通知
   ```

3. **Opt-in checkbox**（订场表单）  
   - 「我同意透过 WhatsApp 接收预约相关通知」  
   - 记录 `user.whatsappOptIn` 或 booking 级别 consent（合规 best practice）

---

## 测试

- [ ] 订场成功页显示提示，不影响现有 layout  
- [ ] 文案唔提及 Updates tab  
- [ ] 多语言（如有 en 版）同步
