# 店鋪 SaaS 後台與自訂域名

## 架構概覽

| 層級 | URL | 誰用 |
|------|-----|------|
| PickCourt 聯盟 | `/`（搜尋：`/search`；別名 `/pickcourt`） | 球友搜尋、瀏覽 |
| 店鋪公開頁 | `/store/:storeSlug` | 場地介紹、預約入口 |
| **店鋪後台** | `/store/:storeSlug/admin` | 加盟店員工／店長 |
| **平台後台** | `/admin-v2` | Super Admin  only |

### 店鋪後台功能（每間加盟店）

- 店鋪介紹（slug、品牌、地區、介紹文）
- 預約管理／日曆
- 場地管理
- 活動中心、恆常活動
- 兌換券、充值優惠
- 會計／用量
- 教練要請、教練課堂
- 假期、預約設定

### 僅 Super Admin（`/admin-v2`）

- 全部店鋪 CRUD、聯盟開關、域名
- 用戶／會籍／Tier
- GameHall、EDM、維護模式
- 全平台分析、報告、商店

---

## 帳號類型與指派（舊版 vs 新版）

| 類型 | 如何設定 | 去哪裡 |
|------|----------|--------|
| **平台超級管理員（舊版）** | `/admin-v2` → 用戶管理 →「超級管理員」分頁，或將 `role` 設為 `admin` | `/admin-v2` 全平台 |
| **店鋪店長／店員（新版）** | `/admin-v2` → **店鋪員工** →「建立店鋪帳號」或「指派現有球友」 | `/store/{slug}/admin` |
| **球友** | 自行註冊或於用戶管理「球友／教練」分頁建立 | 前台 |

**重要：**

- 店鋪 `staff`／`manager` **不可**在用戶管理裡改角色，請用「店鋪員工」頁面。
- 球友用戶列表**預設不含** `staff` 與 `admin`。
- 建議為每間店建立**專用店鋪帳號**（建立店鋪帳號），勿與球友帳號混用。

### 指派店鋪員工步驟

1. 店鋪須 `allianceEnabled: true` 且已設 `district`
2. 平台 admin → `/admin-v2?tab=tenant-staff`
3. **建立店鋪帳號**（建議）：填姓名、email、密碼、電話、店鋪、店長或店員
4. 或 **指派現有球友**：對方須已註冊且 `role=user`
5. 員工登入後自動進入 `/store/{slug}/admin`

---

## 本機開發：店鋪後台

1. 確認店鋪 `allianceEnabled: true` 且已設定 `district`
2. 於 **平台後台 → 店鋪員工** 建立或指派帳號（見上文）
3. 登入後自動進入：`/store/lai-chi-kok/admin`（以第一間管理店鋪為例）

公開頁：`http://localhost:3000/store/lai-chi-kok`

---

## 自訂域名（每店獨立域名）

**可以。** 每間加盟店可設定不同的前台／後台域名，例如：

| 店鋪 | `consumerDomain` | `adminDomain` |
|------|------------------|---------------|
| A 店 | `a.pickcourt.hk` | `admin.a.pickcourt.hk` |
| B 店 | `b.pickcourt.hk` | `admin.b.pickcourt.hk` |

亦可使用完全獨立域名（如 `abc.com` / `admin.abc.com`），DNS 設定方式相同。

所有域名 DNS 皆指向 **pickcourt.hk** 同一套應用（CNAME → 主機），後端依 HTTP `Host` 標頭比對 `Store.consumerDomain` / `Store.adminDomain` 解析 tenant。

### 資料庫設定

在 **平台後台 → 店鋪管理** 為加盟店設定：

| 欄位 | 範例 | 用途 |
|------|------|------|
| `adminDomain` | `admin.lck.pickcourt.hk` | 店鋪後台專用域名 |
| `consumerDomain` | `lck.pickcourt.hk` | 店鋪前台（可選） |

僅 **加盟聯盟**（`allianceEnabled`）店鋪可使用 SaaS 域名。

### DNS（UAT：`uat.pickcourt.hk`）

Testing server 建議 DNS：

```
uat.pickcourt.hk              → A 或 CNAME → 伺服器 IP
lck.uat.pickcourt.hk          → A 或 CNAME → 同上（荔枝角前台）
admin.lck.uat.pickcourt.hk    → A 或 CNAME → 同上（荔枝角後台）
```

加盟店增多時可改 `*.uat.pickcourt.hk` 通配 + 通配 SSL。

### 反向代理

所有店鋪域名指向同一 React build + Node API，後端依 `Host` 解析 tenant。

**Apache2（UAT 推薦）** — 完整範例：`scripts/apache-pickcourt-uat.conf.example`

```bash
sudo a2enmod proxy proxy_http rewrite headers ssl
sudo cp scripts/apache-pickcourt-uat.conf.example /etc/apache2/sites-available/pickcourt-uat.conf
# 修改 DocumentRoot、SSL 路徑、ProxyPass 端口
sudo ln -sf /etc/apache2/sites-available/pickcourt-uat.conf /etc/apache2/sites-enabled/
sudo apache2ctl configtest && sudo systemctl reload apache2
```

重點：

| 設定 | 用途 |
|------|------|
| `ProxyPreserveHost On` | API 收到正確 `Host`（例 `lck.uat.pickcourt.hk`） |
| `ProxyPass /api/ http://127.0.0.1:5001/api/` | 轉發到 Node |
| `RequestHeader set X-Forwarded-Host` | tenant 解析備用 |
| Directory `RewriteRule` → `index.html` | React Router SPA |

SSL（Let's Encrypt 範例）：

```bash
# 主域名 + 已知子域名
sudo certbot --apache -d uat.pickcourt.hk -d lck.uat.pickcourt.hk -d admin.lck.uat.pickcourt.hk

# 或通配（需 DNS API）
# sudo certbot certonly --dns-cloudflare ... -d uat.pickcourt.hk -d '*.uat.pickcourt.hk'
```

**Nginx** — 另見 `scripts/nginx-pickcourt-multitenant.conf.example`

API 同樣需轉發 `Host` 標頭到 Node（Apache 用 `ProxyPreserveHost On`）。

### 前端行為

- 訪問 `lck.pickcourt.hk` → 自動導向該店公開頁 `/store/{slug}`
- 訪問 `lck.pickcourt.hk/admin` → 導向 `/store/{slug}/admin`
- 訪問 `admin.lck.pickcourt.hk` → 導向店鋪後台
- 自訂域名下會隱藏 PickCourt 主站 Navbar／Footer，呈現白標體驗

### Tenant 解析

後端 `GET /api/platform/tenant/resolve` 會依：

1. 請求 `Host` / `X-Forwarded-Host`
2. 比對 Store.`adminDomain` 或 `consumerDomain`

回傳對應加盟店。前端可於載入時呼叫此 API，再導向 `/store/{slug}/admin`。

### 本機測試域名（可選）

編輯 `/etc/hosts`：

```
127.0.0.1  lck.local
127.0.0.1  admin.lck.local
```

在平台後台 → 店鋪管理，為加盟店設定：

| 欄位 | 本機範例 |
|------|----------|
| `consumerDomain` | `lck.local` |
| `adminDomain` | `admin.lck.local` |

並確認 `allianceEnabled: true`、`district` 已填。

**驗證腳本（deploy 前後建議跑）：**

```bash
# 盤點 DB 設定
npm run verify-tenant-domains

# 寫入 testing 域名（依你的 server 改）
npm run verify-tenant-domains -- --set lai-chi-kok \
  --consumer lck.uat.pickcourt.hk \
  --admin admin.lck.uat.pickcourt.hk

# Deploy 後 HTTP 驗證
npm run verify-tenant-domains -- --http --base https://uat.pickcourt.hk
```

本機 API：

```bash
curl -s "http://localhost:5001/api/platform/tenant/resolve?host=admin.lck.local" | jq
```

本機瀏覽器：`http://lck.local:3000` → 應導向 `/store/lai-chi-kok`

Nginx 範例：`scripts/nginx-pickcourt-multitenant.conf.example`  
Apache UAT 範例：`scripts/apache-pickcourt-uat.conf.example`

---

## Testing Server 部署檢查清單（`uat.pickcourt.hk` + Apache2）

Deploy `feature/picklecourt-platform` 到 UAT 時：

| 步驟 | 說明 |
|------|------|
| 1. Build | `npm run build` → 複製 `client/build` 到 `/var/www/pickcourt/client/build` |
| 2. API | PM2/systemd 跑 Node，`127.0.0.1:5001`（或你的 `PORT`） |
| 3. Apache | `scripts/apache-pickcourt-uat.conf.example`，`ProxyPass /api/` 指向上步 |
| 4. `.env` | `PUBLIC_WEB_URL=https://uat.pickcourt.hk`、`CLIENT_URL` 同值、`TRUST_PROXY_HOPS=1` |
| 5. DNS | `uat.pickcourt.hk`、`lck.uat.pickcourt.hk`、`admin.lck.uat.pickcourt.hk` → 伺服器 IP |
| 6. SSL | `certbot --apache -d uat.pickcourt.hk -d lck.uat.pickcourt.hk -d admin.lck.uat.pickcourt.hk` |
| 7. DB 域名 | 見下方一鍵指令 |
| 8. 驗證 | `npm run verify-tenant-domains -- --http --base https://uat.pickcourt.hk` |

**UAT 店鋪域名（荔枝角）：**

```bash
npm run verify-tenant-domains -- --set lai-chi-kok \
  --consumer lck.uat.pickcourt.hk \
  --admin admin.lck.uat.pickcourt.hk
```

**`.env` UAT 範例：**

```env
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://.../你的-uat-db
PUBLIC_WEB_URL=https://uat.pickcourt.hk
CLIENT_URL=https://uat.pickcourt.hk
TRUST_PROXY_HOPS=1
```

前端與 API 同域時，production build 預設用 `/api`（通常不需設 `REACT_APP_API_URL`）。

**瀏覽器預期：**

| URL | 結果 |
|-----|------|
| `https://uat.pickcourt.hk/` | PickCourt 聯盟首頁 |
| `https://lck.uat.pickcourt.hk/` | → `/store/lai-chi-kok`（白標，無 PickCourt Nav） |
| `https://lck.uat.pickcourt.hk/admin` | → 店鋪後台 |
| `https://admin.lck.uat.pickcourt.hk/` | → 店鋪後台 |

若仍是 PickCourt 首頁：打開 DevTools → Network → `tenant/resolve` 是否 `resolved: true`。

---

## 登入與路由

| 路徑 | 說明 |
|------|------|
| `/login` | 統一登入 |
| `/pickcourt/login` | 自動導向 `/login` |
| `/picklecourt/login` | 舊連結，自動導向 `/login` |
| 登入後 admin | → `/admin-v2` |
| 登入後 staff | → `/store/{slug}/admin` |

`pickcourt`、`picklecourt`、`search` 已加入預約路由保留字，不會與 deep link 衝突。

原 PickleVibes 主站保留於 `/picklevibes`（舊連結相容）。

---

## 常見問題

**Q: 員工登入後見到「權限不足」？**  
A: 確認已指派 `TenantMembership`，且店鋪 `allianceEnabled: true`。

**Q: 自訂域名打開仍是 PickCourt 首頁？**  
A: 確認 DNS 已指向應用、店鋪已設 `consumerDomain`／`adminDomain`，且 `allianceEnabled: true`。前端會呼叫 `tenant/resolve` 自動導向。

**Q: 如何上傳店鋪 Logo？**  
A: 店鋪後台「店鋪介紹」或平台後台「店鋪管理」可上傳；亦支援貼上外部 URL。後台左上角會顯示該店 Logo 與品牌主色。

**Q: slug 可以改嗎？**  
A: 僅 Super Admin 在平台後台「店鋪管理」修改；修改後舊連結會失效。

**Q: 加盟店為何搜不到某會員？**  
A: 店鋪員工只能查詢**曾於該店有預約記錄**的會員（含 PickCourt 聯盟預約）。**PickleVibes 荔枝角**（`lai-chi-kok`）主店除外，可搜尋全部會員。平台 Super Admin 不受限。
