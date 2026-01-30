# Google Search Console 設定指南

## 📋 目錄
1. [提交 Sitemap](#提交-sitemap)
2. [驗證網站所有權](#驗證網站所有權)
3. [檢查 Sitemap 狀態](#檢查-sitemap-狀態)
4. [其他重要設定](#其他重要設定)

---

## 提交 Sitemap

### 步驟 1: 確認 Sitemap 可以訪問

首先確認您的 sitemap.xml 可以在網路上訪問：

```
https://picklevibes.hk/sitemap.xml
```

如果無法訪問，請確認：
1. 已執行 `npm run build` 構建前端
2. sitemap.xml 已複製到 `client/build/` 目錄
3. Apache 配置允許訪問 .xml 文件

### 步驟 2: 登入 Google Search Console

1. 訪問 [Google Search Console](https://search.google.com/search-console)
2. 使用您的 Google 帳號登入
3. 選擇或新增您的網站屬性（`https://picklevibes.hk`）

### 步驟 3: 提交 Sitemap

1. 在左側選單中，點擊「**Sitemaps**」（網站地圖）
2. 在「**新增 sitemap**」欄位中，輸入：
   ```
   sitemap.xml
   ```
   或完整 URL：
   ```
   https://picklevibes.hk/sitemap.xml
   ```
3. 點擊「**提交**」按鈕
4. 等待 Google 處理（通常需要幾分鐘到幾小時）

### 步驟 4: 驗證提交狀態

提交後，您會看到：
- ✅ **成功**: Sitemap 已提交並正在處理
- ⚠️ **警告**: 有一些問題，但不影響處理
- ❌ **錯誤**: 需要修復的問題

---

## 驗證網站所有權

如果這是您第一次使用 Google Search Console，需要先驗證網站所有權：

### 方法 1: HTML 檔案驗證（推薦）

1. 在 Search Console 中選擇「HTML 檔案」驗證方式
2. 下載提供的 HTML 驗證檔案
3. 將檔案上傳到 `client/public/` 目錄
4. 執行 `npm run build` 重新構建
5. 確認檔案可以通過 `https://picklevibes.hk/google[隨機碼].html` 訪問
6. 在 Search Console 中點擊「驗證」

### 方法 2: HTML 標籤驗證

1. 在 Search Console 中選擇「HTML 標籤」驗證方式
2. 複製提供的 meta 標籤
3. 將標籤添加到 `client/public/index.html` 的 `<head>` 區段
4. 執行 `npm run build` 重新構建
5. 在 Search Console 中點擊「驗證」

### 方法 3: Google Analytics（如果有使用）

如果您的網站已安裝 Google Analytics，可以直接使用該帳號驗證。

---

## 檢查 Sitemap 狀態

### 查看提交的 URL 數量

1. 在「Sitemaps」頁面中，您可以看到：
   - **已提交**: 總共提交的 URL 數量
   - **已建立索引**: 已被 Google 索引的 URL 數量

### 常見狀態說明

| 狀態 | 說明 | 處理方式 |
|------|------|---------|
| ✅ 成功 | Sitemap 正常處理 | 無需操作，等待索引 |
| ⚠️ 部分索引 | 部分 URL 無法索引 | 檢查個別 URL 的問題 |
| ❌ 無法讀取 | Sitemap 無法訪問 | 檢查檔案路徑和權限 |
| ❌ 格式錯誤 | XML 格式不正確 | 驗證 XML 格式 |

### 檢查個別 URL 狀態

1. 在左側選單點擊「**網址檢查**」
2. 輸入要檢查的 URL，例如：`https://picklevibes.hk/about`
3. 查看該 URL 的索引狀態和問題

---

## 其他重要設定

### 1. 提交 robots.txt

確認您的 `robots.txt` 已正確設定並可訪問：

```
https://picklevibes.hk/robots.txt
```

應該包含：
```
User-agent: *
Allow: /

Sitemap: https://picklevibes.hk/sitemap.xml
```

### 2. 檢查索引涵蓋範圍

1. 在左側選單點擊「**索引涵蓋範圍**」
2. 查看：
   - 有效頁面數
   - 警告和錯誤
   - 被排除的頁面

### 3. 設定首選網域

1. 在「設定」→「首選網域」中
2. 選擇 `https://picklevibes.hk`（帶 www 或不帶 www）
3. 建議選擇「**不帶 www**」以保持一致

### 4. 提交變更請求

當您更新重要內容時，可以使用「網址檢查」工具：
1. 輸入已更新的 URL
2. 點擊「**要求建立索引**」
3. 加速 Google 重新索引該頁面

---

## 定期維護

### 每週檢查
- [ ] 查看 Sitemap 狀態
- [ ] 檢查新的索引問題
- [ ] 查看搜尋成效報告

### 每月更新
- [ ] 更新 sitemap.xml 中的 `lastmod` 日期（如果內容有更新）
- [ ] 檢查索引涵蓋範圍報告
- [ ] 檢視搜尋查詢和點擊率

### 更新 Sitemap 日期

當您更新網站內容時，記得更新 sitemap.xml 中的 `lastmod` 日期：

```xml
<lastmod>2025-12-16</lastmod>
```

使用格式：`YYYY-MM-DD`

---

## 疑難排解

### Sitemap 無法訪問

**問題**: 提交後顯示「無法讀取」

**解決方案**:
1. 確認檔案路徑：`https://picklevibes.hk/sitemap.xml`
2. 檢查 Apache 配置是否允許訪問 .xml 文件
3. 確認檔案權限正確
4. 嘗試在瀏覽器中直接訪問 URL

### URL 未被索引

**問題**: 已提交 Sitemap，但 URL 未被索引

**可能原因**:
1. 頁面內容質量不足
2. 頁面被 robots.txt 阻擋
3. 頁面有 noindex meta tag
4. 內容重複或品質不佳

**解決方案**:
1. 檢查頁面是否有 `<meta name="robots" content="noindex">`
2. 確認內容原創且有價值
3. 使用「網址檢查」工具要求建立索引
4. 改善頁面內容和 SEO

### 索引速度慢

**問題**: URL 提交後很久才被索引

**這是正常現象**:
- Google 需要時間爬取和索引新頁面
- 一般需要幾天到幾週
- 可以通過「網址檢查」工具加速特定頁面的索引

---

## 相關資源

- [Google Search Console 說明文件](https://support.google.com/webmasters)
- [Sitemap 格式指南](https://www.sitemaps.org/protocol.html)
- [Google 搜尋最佳做法](https://developers.google.com/search/docs/guides)

---

## 快速檢查清單

提交 Sitemap 前確認：
- [ ] sitemap.xml 可以在 `https://picklevibes.hk/sitemap.xml` 訪問
- [ ] sitemap.xml 格式正確（XML 驗證）
- [ ] 所有 URL 使用 HTTPS
- [ ] 所有 URL 使用絕對路徑
- [ ] robots.txt 包含 sitemap 位置
- [ ] 網站已在 Google Search Console 驗證

提交後檢查：
- [ ] Sitemap 狀態顯示「成功」
- [ ] URL 數量正確
- [ ] 定期檢查索引進度
- [ ] 監控索引錯誤和警告









