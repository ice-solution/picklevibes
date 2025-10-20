# Google Calendar 集成設置指南

本指南將幫助您設置Google Calendar集成，讓用戶的預約自動同步到Google Calendar。

## 🔧 設置步驟

### 1. 創建Google Cloud項目

1. 訪問 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建新項目或選擇現有項目

### 2. 啟用Google Calendar API

**重要**: 這是最關鍵的步驟，如果跳過會導致403錯誤！

1. 在Google Cloud Console中，導航到 **APIs & Services** > **Library**
2. 搜索 "Google Calendar API"
3. 點擊 **Google Calendar API**
4. 點擊 **Enable** 按鈕啟用API
5. 等待幾分鐘讓API啟用生效

**驗證API已啟用**:
- 導航到 **APIs & Services** > **Enabled APIs & services**
- 確認 "Google Calendar API" 在列表中

### 3. 創建服務帳戶

1. 在Google Cloud Console中，導航到 **IAM & Admin** > **Service Accounts**
2. 點擊 **Create Service Account**
3. 填寫服務帳戶詳情：
   - **Name**: `picklevibes-calendar-service`
   - **Description**: `Service account for PickleVibes calendar integration`
4. 點擊 **Create and Continue**

### 4. 生成服務帳戶密鑰

1. 在服務帳戶列表中，找到剛創建的服務帳戶
2. 點擊服務帳戶名稱進入詳情頁
3. 切換到 **Keys** 標籤
4. 點擊 **Add Key** > **Create new key**
5. 選擇 **JSON** 格式
6. 下載JSON文件

### 5. 配置環境變量

將下載的JSON文件中的信息添加到您的 `.env` 文件中：

```env
# Google Calendar 配置
GOOGLE_PROJECT_ID=your_project_id_from_json
GOOGLE_PRIVATE_KEY_ID=your_private_key_id_from_json
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_from_json\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your_service_account_email_from_json
GOOGLE_CLIENT_ID=your_client_id_from_json
```

**重要提示**：
- `GOOGLE_PRIVATE_KEY` 需要包含完整的私鑰，包括 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`
- 私鑰中的換行符需要轉義為 `\n`

### 6. 共享日曆權限

1. 在Google Calendar中，創建一個新的日曆（可選）或使用現有日曆
2. 在日曆設置中，添加服務帳戶郵箱為日曆的共享用戶
3. 給予 **Make changes to events** 權限

### 7. 測試集成

運行以下命令測試Google Calendar集成：

```bash
# 安裝依賴
npm install

# 運行同步腳本
npm run sync-calendar
```

## 📅 功能特性

### 單向同步（服務器 → Google Calendar）
- **每5分鐘**: 檢查新預約並同步到Google Calendar
- **每小時**: 完整同步所有預約和變更
- **每天凌晨2點**: 每日完整同步

**重要**: 這是單向同步，只會將服務器數據同步到Google Calendar，不會從Google Calendar同步回服務器。

### 雙日曆系統

#### 📅 公開日曆（主日曆）
- **標題**: `匹克球預約 - [場地名稱]`
- **描述**: 只包含場地和時間信息
- **用途**: 公眾查看，不包含個人資料
- **內容**:
  ```
  預約詳情：
  - 場地：[場地名稱]
  - 時間：[日期] [開始時間]-[結束時間]
  ```

#### 🔒 私人日曆（PickleVibes 預約詳情）
- **標題**: `匹克球預約 - [場地名稱] ([用戶姓名])`
- **描述**: 包含完整的預約信息
- **用途**: 管理員查看，包含所有詳細信息
- **內容**:
  ```
  預約詳情：
  - 場地：[場地名稱]
  - 時間：[日期] [開始時間]-[結束時間]
  - 參與者：[用戶姓名]
  - 聯繫方式：[郵箱] / [電話]
  - 預約ID：[預約ID]
  - 狀態：[預約狀態]
  - 用戶ID：[用戶ID]
  ```

#### 提醒設置
- **1天前**: 郵件提醒
- **30分鐘前**: 彈窗提醒

### 狀態同步
- **新預約**: 自動創建Google Calendar事件
- **預約變更**: 自動更新Google Calendar事件
- **取消預約**: 自動刪除Google Calendar事件

## 🔍 故障排除

### 常見問題

1. **403 Forbidden - API未啟用**
   - **錯誤信息**: `Google Calendar API has not been used in project...`
   - **解決方案**: 確保已在Google Cloud Console中啟用Google Calendar API
   - **檢查步驟**: 導航到 APIs & Services > Enabled APIs & services，確認Google Calendar API在列表中

2. **認證失敗**
   - 檢查環境變量是否正確設置
   - 確認私鑰格式正確（包含換行符轉義）

3. **權限不足**
   - 確認服務帳戶有日曆權限
   - 檢查日曆共享設置

4. **同步失敗**
   - 檢查網絡連接
   - 查看服務器日誌獲取詳細錯誤信息

### 日誌監控

服務器會記錄以下信息：
- ✅ 成功同步的預約數量
- ❌ 同步失敗的錯誤信息
- 📊 定時任務執行狀態

## 🚀 部署注意事項

### 生產環境
- 確保所有環境變量正確設置
- 定期檢查同步狀態
- 監控Google Calendar API配額

### 安全考慮
- 妥善保管服務帳戶密鑰
- 定期輪換密鑰
- 限制服務帳戶權限範圍

## 📞 支持

如果遇到問題，請檢查：
1. Google Cloud Console中的API配額
2. 服務器日誌中的錯誤信息
3. 環境變量配置是否正確

---

**注意**: 此功能需要Google Calendar API配額。請確保您的Google Cloud項目有足夠的配額來處理預期的API調用量。
