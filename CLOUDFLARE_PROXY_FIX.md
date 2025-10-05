# Cloudflare Proxy 設置修復

## 🐛 問題說明

### 錯誤訊息
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
```

### 原因

當使用 **Cloudflare** 或其他反向代理時：

```
客戶端 → Cloudflare → 您的服務器
```

Cloudflare 會添加以下標頭：
- `X-Forwarded-For`: 客戶端真實 IP
- `X-Forwarded-Proto`: 原始協議 (http/https)
- `CF-Connecting-IP`: Cloudflare 的真實 IP 標頭

但 Express 默認不信任這些標頭（`trust proxy = false`），導致：
- ❌ `express-rate-limit` 無法識別真實用戶
- ❌ 所有請求看起來來自同一個 IP (Cloudflare)
- ❌ 速率限制會錯誤地阻擋所有用戶

## ✅ 解決方案

### 修復代碼

在 `server/index.js` 中添加：

```javascript
const app = express();

// 信任代理 - 因為使用 Cloudflare
app.set('trust proxy', true);

// ... 其他中間件
```

### `trust proxy` 的作用

啟用後，Express 會：
- ✅ 從 `X-Forwarded-For` 讀取真實 IP
- ✅ 從 `X-Forwarded-Proto` 識別 HTTPS
- ✅ `req.ip` 返回客戶端真實 IP，而不是 Cloudflare IP
- ✅ `express-rate-limit` 可以正確限制每個用戶

## 🔍 不同的 `trust proxy` 設置

### 1. `true` - 信任所有代理（適合 Cloudflare）

```javascript
app.set('trust proxy', true);
```

**適用於**:
- ✅ Cloudflare
- ✅ AWS CloudFront
- ✅ 其他 CDN

### 2. 信任特定 IP 範圍（更安全）

```javascript
app.set('trust proxy', ['173.245.48.0/20', '103.21.244.0/22', ...]); // Cloudflare IP
```

**優點**: 更安全，只信任特定 IP

### 3. 信任第一個代理

```javascript
app.set('trust proxy', 1);
```

**適用於**: 單層反向代理（如 Nginx）

### 4. 自定義函數

```javascript
app.set('trust proxy', (ip) => {
  // 檢查 IP 是否是 Cloudflare 的
  return ip.startsWith('173.245.') || ip.startsWith('103.21.');
});
```

## 🌐 Cloudflare 架構

```
客戶端 (真實IP: 1.2.3.4)
    ↓ HTTPS
Cloudflare (代理IP: 173.245.x.x)
    ↓ HTTP + Headers
    X-Forwarded-For: 1.2.3.4
    CF-Connecting-IP: 1.2.3.4
    X-Forwarded-Proto: https
    ↓
您的服務器 (Port 80)
```

### 啟用 `trust proxy` 後

```javascript
// 之前
req.ip = '173.245.48.100'  // Cloudflare IP

// 之後
req.ip = '1.2.3.4'  // 真實客戶端 IP ✅
```

## 📊 影響的功能

啟用 `trust proxy` 後：

| 功能 | 之前 | 之後 |
|------|------|------|
| **速率限制** | 所有用戶被當作同一個 | 每個用戶獨立計算 ✅ |
| **IP 記錄** | 記錄 Cloudflare IP | 記錄真實客戶端 IP ✅ |
| **req.ip** | Cloudflare IP | 真實 IP ✅ |
| **req.protocol** | 'http' | 'https' ✅ |
| **req.secure** | false | true ✅ |

## 🔒 安全考慮

### 為什麼默認是 `false`？

如果沒有使用代理，啟用 `trust proxy` 會有安全風險：
- 惡意用戶可以偽造 `X-Forwarded-For` 標頭
- 繞過 IP 限制

### 使用 Cloudflare 是安全的

因為：
- ✅ Cloudflare 在您的服務器前面
- ✅ 所有流量都經過 Cloudflare
- ✅ 真實的 `X-Forwarded-For` 由 Cloudflare 設置
- ✅ 客戶端無法直接訪問您的服務器

### 額外安全措施（可選）

只允許 Cloudflare IP 訪問：

```javascript
// 在 Apache 中配置
<Directory /var/www/html/picklevibes/client/build>
    Require ip 173.245.48.0/20
    Require ip 103.21.244.0/22
    # ... 其他 Cloudflare IP 範圍
</Directory>
```

或使用防火牆：
```bash
# 只允許 Cloudflare IP
sudo ufw allow from 173.245.48.0/20 to any port 80
sudo ufw allow from 103.21.244.0/22 to any port 80
# ... 添加所有 Cloudflare IP 範圍
```

## 🧪 測試修復

### 1. 重啟服務器

```bash
pm2 restart picklevibes
```

### 2. 檢查 IP 記錄

創建測試端點（可選）：

```javascript
// 在 server/index.js 添加
app.get('/api/test-ip', (req, res) => {
  res.json({
    ip: req.ip,
    ips: req.ips,
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'cf-connecting-ip': req.headers['cf-connecting-ip']
    }
  });
});
```

訪問: `https://picklevibes.hk/api/test-ip`

應該看到您的真實 IP，而不是 Cloudflare IP。

### 3. 檢查日誌

```bash
pm2 logs picklevibes

# 錯誤應該消失
# 不再看到 ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
```

## 📋 完整修復步驟

```bash
# 1. 確保代碼已更新
cd /var/www/html/picklevibes
git pull origin main

# 2. 檢查修改
grep "trust proxy" server/index.js
# 應該看到: app.set('trust proxy', true);

# 3. 重啟後端
pm2 restart picklevibes

# 4. 測試
curl https://picklevibes.hk/api/courts
# 應該正常工作，不再有錯誤
```

## ✅ 檢查清單

- [ ] `server/index.js` 已添加 `app.set('trust proxy', true)`
- [ ] 後端已重啟
- [ ] 錯誤日誌中不再顯示 `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`
- [ ] 速率限制正常工作
- [ ] API 正常響應

## 📚 相關資源

- [Express trust proxy 文檔](https://expressjs.com/en/guide/behind-proxies.html)
- [express-rate-limit 錯誤說明](https://express-rate-limit.github.io/ERR_ERL_UNEXPECTED_X_FORWARDED_FOR/)
- [Cloudflare IP 範圍](https://www.cloudflare.com/ips/)

## 🎯 總結

這個錯誤是正常的配置問題，因為：
1. 您使用 Cloudflare 作為代理
2. Cloudflare 添加了 `X-Forwarded-For` 標頭
3. Express 需要信任這些標頭

修復後，系統可以：
- ✅ 正確識別每個用戶的真實 IP
- ✅ 速率限制按用戶而不是按 Cloudflare IP
- ✅ 安全日誌記錄真實 IP
- ✅ 錯誤消失

