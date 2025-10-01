#!/bin/bash

# 啟用 Apache 所需模組

echo "🔧 啟用 Apache 模組..."

# 啟用 Proxy 相關模組
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_balancer
sudo a2enmod lbmethod_byrequests

# 啟用 Rewrite 模組（前端路由）
sudo a2enmod rewrite

# 啟用 Headers 模組（安全標頭）
sudo a2enmod headers

# 啟用 SSL 模組（如果需要）
sudo a2enmod ssl

# 啟用 Expires 模組（快取）
sudo a2enmod expires

# 啟用 Deflate 模組（壓縮）
sudo a2enmod deflate

# 啟用 RemoteIP 模組（Cloudflare 真實 IP）
sudo a2enmod remoteip

echo "✅ 模組啟用完成！"
echo ""
echo "測試配置..."
sudo apache2ctl configtest

echo ""
echo "重啟 Apache..."
sudo systemctl restart apache2

echo ""
echo "✅ 完成！"
echo ""
echo "檢查狀態："
sudo systemctl status apache2

