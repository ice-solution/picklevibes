# 統計API開發計劃

## 📊 概述
隨著數據量增長，需要建立統一的統計API來提供各種業務指標和數據分析。

## 🎯 目標
- 集中處理所有統計數據
- 提供實時業務指標
- 支持管理員儀表板
- 優化數據查詢性能

## 📈 統計API需求

### 1. 兌換碼統計
**當前問題：** 統計卡片顯示的是當前頁面數據，而非全局總數

**需要統計：**
- 總兌換碼數量
- 有效兌換碼數量
- 總使用次數
- 總折扣金額

### 2. 預約統計
**需要統計：**
- 總預約數量
- 已確認預約數量
- 已取消預約數量
- 總收入（積分）
- 今日預約數量
- 本月預約數量

### 3. 用戶統計
**需要統計：**
- 總用戶數量
- 活躍用戶數量（最近30天有活動）
- VIP會員數量
- 新註冊用戶（今日/本月）
- 用戶增長趨勢

### 4. 財務統計
**需要統計：**
- 每月營業額
- 每日收入
- 充值總額
- 積分消耗總額
- 平均每用戶收入

### 5. 場地統計
**需要統計：**
- 各場地使用率
- 最受歡迎時段
- 場地收入排行
- 包場預約統計

## 🏗️ 技術架構

### API端點設計
```
GET /api/stats/overview          # 總覽統計
GET /api/stats/redeem-codes     # 兌換碼統計
GET /api/stats/bookings         # 預約統計
GET /api/stats/users            # 用戶統計
GET /api/stats/financial        # 財務統計
GET /api/stats/courts           # 場地統計
```

### 數據結構
```javascript
// 總覽統計響應
{
  "success": true,
  "data": {
    "redeemCodes": {
      "total": 150,
      "active": 45,
      "totalUsage": 1200,
      "totalDiscount": 50000
    },
    "bookings": {
      "total": 2500,
      "confirmed": 2200,
      "cancelled": 200,
      "today": 15,
      "thisMonth": 180
    },
    "users": {
      "total": 500,
      "active": 350,
      "vip": 80,
      "newToday": 5,
      "newThisMonth": 45
    },
    "financial": {
      "monthlyRevenue": 150000,
      "dailyRevenue": 5000,
      "totalRecharge": 200000,
      "totalSpent": 180000
    }
  }
}
```

## 🔧 實現計劃

### Phase 1: 基礎統計API
- [ ] 創建統計服務 (`server/services/statsService.js`)
- [ ] 實現總覽統計API
- [ ] 添加數據緩存機制
- [ ] 更新前端統計卡片

### Phase 2: 詳細統計
- [ ] 兌換碼詳細統計
- [ ] 預約詳細統計
- [ ] 用戶詳細統計
- [ ] 財務詳細統計

### Phase 3: 高級分析
- [ ] 趨勢分析
- [ ] 同比/環比分析
- [ ] 預測分析
- [ ] 報表生成

## 📊 數據庫優化

### 索引優化
```javascript
// 為統計查詢添加索引
db.bookings.createIndex({ "status": 1, "createdAt": 1 })
db.bookings.createIndex({ "date": 1, "status": 1 })
db.users.createIndex({ "createdAt": 1, "role": 1 })
db.redeemcodes.createIndex({ "isActive": 1, "validUntil": 1 })
```

### 聚合查詢
```javascript
// 使用MongoDB聚合管道優化統計查詢
const stats = await Booking.aggregate([
  {
    $match: { status: 'confirmed' }
  },
  {
    $group: {
      _id: null,
      totalBookings: { $sum: 1 },
      totalRevenue: { $sum: '$pricing.totalPrice' }
    }
  }
]);
```

## 🚀 性能優化

### 緩存策略
- Redis緩存熱門統計數據
- 設置合理的緩存過期時間
- 實時更新關鍵指標

### 分頁和限制
- 大數據集使用分頁
- 設置查詢時間限制
- 避免全表掃描

## 📱 前端集成

### 管理員儀表板
- 實時統計卡片
- 圖表可視化
- 數據刷新機制
- 導出功能

### 響應式設計
- 移動端適配
- 加載狀態
- 錯誤處理

## 🔒 安全考慮

### 權限控制
- 只有管理員可訪問詳細統計
- API速率限制
- 敏感數據脫敏

### 數據保護
- 用戶隱私保護
- 數據加密
- 審計日誌

## 📅 開發時間線

### Week 1-2: 基礎架構
- 統計服務框架
- 基礎API端點
- 數據庫優化

### Week 3-4: 核心功能
- 主要統計指標
- 前端集成
- 性能優化

### Week 5-6: 高級功能
- 趨勢分析
- 報表生成
- 用戶體驗優化

## 🧪 測試計劃

### 單元測試
- 統計計算邏輯
- API端點測試
- 數據一致性驗證

### 性能測試
- 大數據量測試
- 並發訪問測試
- 緩存效果測試

### 用戶測試
- 管理員使用體驗
- 數據準確性驗證
- 界面友好性測試

## 📝 注意事項

1. **數據一致性**: 確保統計數據與實際數據一致
2. **性能監控**: 監控API響應時間和數據庫查詢性能
3. **可擴展性**: 設計要考慮未來功能擴展
4. **維護性**: 代碼結構清晰，易於維護和修改

## 🔄 後續優化

- 實時數據推送
- 自定義報表
- 數據導出功能
- 移動端APP集成
- 第三方分析工具集成

---

**創建時間**: 2024年12月
**版本**: v2.0 計劃
**狀態**: 待開發
