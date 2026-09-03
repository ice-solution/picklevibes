# 選手 Role（已實作）

## 權益

| 項目 | 說明 |
|------|------|
| 提前訂場 | 依 **預約設定 → 選手** 天數（預設 21 日） |
| 訂場價 | 同 VIP **8 折**（`hasBookingVipDiscount`） |
| 收款連結 | Admin 建立；**選手登入**打開連結 → **半價**（現金／積分） |
| 到期 | `roleExpiry` 過後 → `role=user`，恢復 **VIP 會籍** |

## Admin 操作

1. **用戶管理** → 編輯角色 → 選「選手」→ 設定期限（日）
2. **預約設定** → 調整「選手」可預約天數

## 技術

- `server/utils/memberBenefits.js`
- `server/utils/membershipChecker.js` → `checkExpiredAthleteRoles`
- `POST/GET payment-links` 依登入 user role 計價
