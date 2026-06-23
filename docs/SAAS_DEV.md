# SaaS / PickCourt 開發程序

> 在 `feature/picklecourt-platform` 分支開發，使用本機 `picklevibes-saas-dev` 資料庫。

## 分支與環境

| 用途 | Git 分支 | 資料庫 |
|------|----------|--------|
| 現有產品維運 | `release/picklevibes-v1` → merge `uat` | UAT / Production 雲端 DB |
| SaaS / PickCourt 開發 | `feature/picklecourt-platform` | 本機 `picklevibes-saas-dev` |

## 本機設定

`.env` 開發時使用：

```env
MONGODB_URI=mongodb://127.0.0.1:27017/picklevibes-saas-dev
# Open API 預設關閉；日後開放時設為 true
# OPEN_API_ENABLED=false
```

啟動：

```bash
git checkout feature/picklecourt-platform
npm run dev
```

前端預設 **http://localhost:3000**（PickCourt 首頁）；正式環境：**https://pickcourt.hk**

```bash
npm run migrate-store-tenant          # Phase 1：補 Store tenant 欄位
npm run migrate-platform-membership     # Phase 3：User 會籍 → PlatformMembership
npm run migrate-store-district          # 店鋪香港 18 區
npm run migrate-game-hall-store         # Phase 5：GameHall 綁定加盟店鋪
```

## 還原 saas-dev（從 UAT dump）

```bash
# 1. 從 UAT 備份（只需做一次，或要刷新資料時重做）
mongodump --uri="你的_UAT_MONGODB_URI" --out=./backup/uat-$(date +%Y%m%d)

# 2. 還原到本機 saas-dev
npm run db-restore-saas-dev
# 或指定目錄：
./scripts/restore-saas-dev.sh ./backup/uat-20260618
```

**注意：** `mongorestore` 路徑要指到 `backup/uat-XXXX/`（上一層），不是 `backup/uat-XXXX/picklevibes/`。

## 日常指令

```bash
npm run db-baseline-report    # 唯讀盤點（遷移前／大改前建議跑）
npm run db-restore-saas-dev   # 重置本機 saas-dev 為 UAT 快照
npm run dev                   # 前後端開發
```

## 平台商業規則

- **僅加盟店鋪（`allianceEnabled: true`）可使用 SaaS**：多租戶後台、員工指派、自訂域名、GameHall 計分廳。
- **Open Booking API（`/api/open`）暫停開發**：預設關閉；設 `OPEN_API_ENABLED=true` 才開放。
- **PickCourt 聯盟搜尋**僅查 `allianceEnabled` 店鋪；店鋪須設定 `district`（香港 18 區）。

## 開發里程碑（建議順序）

| 階段 | 內容 | 狀態 |
|------|------|------|
| 0 | saas-dev DB + 本文件 + baseline 腳本 | ✅ |
| 0b | PickCourt 首頁 `/` + 場地搜尋 `/search` | ✅ |
| 1 | `Store` tenant 欄位 + `resolveTenant` + `/api/platform` | ✅ |
| 2 | `TenantMembership` / staff RBAC | ✅ |
| 3 | `PlatformMembership`（會籍遷到 PickCourt） | ✅ |
| 4 | Open API 擴充（聯盟查詢／下單） | ⏸ 暫停 |
| 5 | `GameHall.store` + 計分系統合併 | ✅ |
| 5b | 加盟限定 SaaS + Open API 功能開關 | ✅ |
| 6 | 聯盟預約流程 + 店鋪品牌公開頁 | 🚧 搜尋帶時段深連結、店鋪後台鎖店、活動／兌換券 API 鎖店 |
| 6a | 店鋪會員查詢（曾預約才可搜） | ✅ |
| 6b | 自訂域名 E2E + 會籍前台展示 | 🚧 Nav+Profile 會籍 ✅；Apache UAT 範例待 deploy 驗證 |

## Migration 原則

1. **只加欄位、不刪舊欄位**（過渡期雙寫）
2. 腳本 **可重跑**（idempotent）
3. 大改前先 `npm run db-baseline-report`
4. 對 UAT / prod 跑 migration 前先 `mongodump`
5. **不要**在 `release/picklevibes-v1` 或 `uat` 上做大重構

## 合併回 UAT 時機

`feature/picklecourt-platform` 的變更，在以下條件滿足後才 merge 到 `uat`：

- migration 腳本已在 saas-dev 驗證可重跑
- 不破壞現有 PickleVibes 功能（或已有 feature flag）
- 已更新本文件里程碑狀態

## 相關檔案

- `server/scripts/dbBaselineReport.js` — 資料盤點
- `server/config/platformFeatures.js` — Open API 開關、加盟 SaaS 規則
- `server/utils/allianceStore.js` — 加盟店鋪驗證
- `scripts/restore-saas-dev.sh` — 還原 saas-dev
- `server/models/Store.js` — Tenant 擴充起點
- `server/models/GameHall.js` — 計分廳 `store` 關聯
- [STORE_SAAS.md](./STORE_SAAS.md) — 店鋪後台與自訂域名設定
