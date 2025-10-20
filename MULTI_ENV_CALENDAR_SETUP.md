# 多環境 Google Calendar 設置指南

## 🎯 概述

本系統支持多環境的 Google Calendar 同步，通過在 `.env` 文件中配置不同環境的日曆ID，系統會根據 `NODE_ENV` 自動選擇對應的日曆。

## 📋 環境配置

### 1. 開發環境 (Development)
- **環境變量**: `NODE_ENV=development`
- **日曆配置**: 使用 `GOOGLE_CALENDAR_DEVELOPMENT_ID`
- **用途**: 本地開發和測試

### 2. UAT環境 (UAT)
- **環境變量**: `NODE_ENV=uat`
- **日曆配置**: 使用 `GOOGLE_CALENDAR_UAT_ID`
- **用途**: 用戶驗收測試

### 3. 生產環境 (Production)
- **環境變量**: `NODE_ENV=production`
- **日曆配置**: 使用 `GOOGLE_CALENDAR_PRODUCTION_ID`
- **用途**: 正式生產環境

## 🛠️ 設置步驟

### 步驟 1: 創建不同環境的日曆

1. **開發環境日曆**:
   - 在 Google Calendar 中創建新日曆
   - 命名為 "PickleVibes Dev"
   - 獲取日曆ID (格式: `xxx@group.calendar.google.com`)

2. **UAT環境日曆**:
   - 在 Google Calendar 中創建新日曆
   - 命名為 "PickleVibes UAT"
   - 獲取日曆ID

3. **生產環境日曆**:
   - 使用現有的 "vibes pickle 預約日曆"
   - 日曆ID: `043b95582713f2c97975e59b6e56f1cf46f78c19bbaf6d9eb08b2292461ae903@group.calendar.google.com`

### 步驟 2: 在 .env 文件中配置所有環境

在您的 `.env` 文件中添加以下配置：

```bash
# 多環境 Google Calendar 配置
# 開發環境
GOOGLE_CALENDAR_DEVELOPMENT_ID=primary
GOOGLE_CALENDAR_DEVELOPMENT_PRIVATE_ID=

# UAT環境
GOOGLE_CALENDAR_UAT_ID=your_uat_calendar_id@group.calendar.google.com
GOOGLE_CALENDAR_UAT_PRIVATE_ID=

# 生產環境
GOOGLE_CALENDAR_PRODUCTION_ID=043b95582713f2c97975e59b6e56f1cf46f78c19bbaf6d9eb08b2292461ae903@group.calendar.google.com
GOOGLE_CALENDAR_PRODUCTION_PRIVATE_ID=
```

## 🚀 使用方法

### 環境切換

只需要修改 `NODE_ENV` 環境變量：

```bash
# 開發環境
NODE_ENV=development

# UAT環境
NODE_ENV=uat

# 生產環境
NODE_ENV=production
```

### 同步操作

```bash
# 查看當前同步狀態
npm run manage-sync stats

# 智能同步（根據當前 NODE_ENV）
npm run smart-sync

# 同步今天的預約
npm run sync-today

# 同步本月的預約
npm run sync-month
```

## 📊 環境隔離

### 數據隔離
- **開發環境**: 使用 `picklevibes_dev` 數據庫
- **UAT環境**: 使用 `picklevibes_uat` 數據庫
- **生產環境**: 使用 `picklevibes_prod` 數據庫

### 日曆隔離
- **開發環境**: 同步到 "PickleVibes Dev" 日曆
- **UAT環境**: 同步到 "PickleVibes UAT" 日曆
- **生產環境**: 同步到 "vibes pickle 預約日曆"

## 🔧 高級配置

### 自定義日曆ID

如果不想使用環境變量，可以直接修改 `server/services/googleCalendarService.js` 中的 `setCalendarIdsByEnvironment` 方法：

```javascript
setCalendarIdsByEnvironment(env) {
  switch (env) {
    case 'development':
      this.publicCalendarId = 'your_custom_dev_calendar_id@group.calendar.google.com';
      break;
    case 'uat':
      this.publicCalendarId = 'your_custom_uat_calendar_id@group.calendar.google.com';
      break;
    case 'production':
      this.publicCalendarId = 'your_custom_prod_calendar_id@group.calendar.google.com';
      break;
  }
}
```

### 私人日曆配置

如果需要使用私人日曆存儲詳細信息，可以設置對應的 `GOOGLE_CALENDAR_*_PRIVATE_ID` 環境變量。

## 🎯 最佳實踐

1. **開發環境**: 使用 `primary` 日曆或創建專用測試日曆
2. **UAT環境**: 創建專用UAT日曆，用於用戶驗收測試
3. **生產環境**: 使用正式的生產日曆

4. **定期清理**: 定期清理測試環境的數據
5. **權限管理**: 確保服務賬戶有權限訪問所有環境的日曆

## 🚨 注意事項

1. **環境變量**: 確保每個環境的 `.env` 文件包含正確的日曆ID
2. **權限設置**: 確保 Google 服務賬戶有權限訪問所有環境的日曆
3. **數據備份**: 在切換環境前，建議備份重要數據
4. **測試驗證**: 每次切換環境後，先測試同步功能

## 📞 故障排除

### 常見問題

1. **日曆ID錯誤**: 檢查環境變量中的日曆ID是否正確
2. **權限不足**: 確保服務賬戶有權限訪問目標日曆
3. **環境切換失敗**: 檢查對應的 `.env.*` 文件是否存在

### 調試命令

```bash
# 查看當前環境配置
npm run switch-env

# 檢查同步狀態
npm run manage-sync stats

# 清除所有數據重新開始
npm run clear-sync
```
