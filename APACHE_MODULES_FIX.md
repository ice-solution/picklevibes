# Apache 模組啟用指南

## ⚠️ 錯誤訊息
```
Invalid command 'ProxyPreserveHost', perhaps misspelled or defined by a module not included in the server configuration
```

## 🔧 原因
Apache 的 proxy 模組沒有啟用。

## ✅ 解決方案

### 方法 1: 使用腳本（推薦）

```bash
# 賦予執行權限
chmod +x enable-apache-modules.sh

# 運行腳本
sudo bash enable-apache-modules.sh
```

### 方法 2: 手動啟用

```bash
# 1. 啟用必要的模組
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod expires
sudo a2enmod deflate
sudo a2enmod remoteip

# 2. 測試配置
sudo apache2ctl configtest

# 3. 重啟 Apache
sudo systemctl restart apache2

# 4. 檢查狀態
sudo systemctl status apache2
```

## 📋 完整模組列表

| 模組 | 用途 | 必需 |
|------|------|------|
| `proxy` | 代理功能基礎模組 | ✅ 必需 |
| `proxy_http` | HTTP 代理 | ✅ 必需 |
| `rewrite` | URL 重寫（React Router） | ✅ 必需 |
| `headers` | HTTP 標頭控制 | ✅ 必需 |
| `expires` | 快取控制 | ⭐ 推薦 |
| `deflate` | Gzip 壓縮 | ⭐ 推薦 |
| `remoteip` | 獲取真實 IP（Cloudflare） | ⭐ 推薦 |
| `ssl` | HTTPS 支持 | ⚠️ 如需本地 SSL |

## 🔍 檢查模組是否啟用

```bash
# 列出所有已啟用的模組
apache2ctl -M

# 或
ls -la /etc/apache2/mods-enabled/

# 搜索特定模組
apache2ctl -M | grep proxy
```

### 應該看到：
```
proxy_module (shared)
proxy_http_module (shared)
rewrite_module (shared)
headers_module (shared)
expires_module (shared)
deflate_module (shared)
remoteip_module (shared)
```

## 🐛 如果仍有問題

### 問題 1: a2enmod 命令不存在

**原因**: 可能不是 Debian/Ubuntu 系統

**解決**:
```bash
# CentOS/RHEL
sudo dnf install httpd
# 手動編輯 /etc/httpd/conf/httpd.conf 啟用模組

# 檢查 Apache 版本
httpd -v
# 或
apache2 -v
```

### 問題 2: 模組文件不存在

**原因**: 未安裝 Apache 或安裝不完整

**解決**:
```bash
# 重新安裝 Apache
sudo apt-get update
sudo apt-get install --reinstall apache2
```

### 問題 3: 配置測試失敗

**查看詳細錯誤**:
```bash
sudo apache2ctl configtest

# 查看錯誤日誌
sudo tail -50 /var/log/apache2/error.log
```

## ✅ 驗證配置

### 1. 測試配置文件
```bash
sudo apache2ctl configtest
# 應該顯示: Syntax OK
```

### 2. 測試代理功能
```bash
# 啟動後端
pm2 start picklevibes

# 測試 API
curl http://localhost:5001/api/courts
# 應該返回場地數據

# 測試通過 Apache 代理
curl http://localhost/api/courts
# 應該也返回場地數據
```

### 3. 測試前端路由
```bash
# 測試 React Router
curl http://localhost/booking
# 應該返回 index.html 而不是 404
```

## 📝 完整部署檢查清單

```bash
# 1. 啟用模組
sudo bash enable-apache-modules.sh

# 2. 複製配置
sudo cp apache-config-cloudflare.conf /etc/apache2/sites-available/picklevibes.conf

# 3. 啟用站點
sudo a2ensite picklevibes.conf
sudo a2dissite 000-default.conf

# 4. 測試配置
sudo apache2ctl configtest

# 5. 重啟 Apache
sudo systemctl restart apache2

# 6. 檢查狀態
sudo systemctl status apache2

# 7. 測試訪問
curl http://localhost
curl http://localhost/api/courts
```

## 🔧 常用命令

```bash
# 啟用模組
sudo a2enmod MODULE_NAME

# 禁用模組
sudo a2dismod MODULE_NAME

# 列出可用模組
ls /etc/apache2/mods-available/

# 列出已啟用模組
ls /etc/apache2/mods-enabled/
apache2ctl -M

# 測試配置
sudo apache2ctl configtest

# 重啟 Apache
sudo systemctl restart apache2

# 重新加載配置（不中斷連接）
sudo systemctl reload apache2

# 查看狀態
sudo systemctl status apache2

# 查看日誌
sudo tail -f /var/log/apache2/error.log
sudo tail -f /var/log/apache2/access.log
```

## 📞 需要更多幫助？

如果問題仍然存在，請提供以下信息：
1. Apache 版本: `apache2 -v`
2. 操作系統: `lsb_release -a`
3. 已啟用的模組: `apache2ctl -M`
4. 錯誤日誌: `sudo tail -50 /var/log/apache2/error.log`

