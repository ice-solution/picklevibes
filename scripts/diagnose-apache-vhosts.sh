#!/bin/bash
#
# Apache VirtualHost 診斷（PickCourt / PickleVibes 共用 server）
# 用法：sudo ./scripts/diagnose-apache-vhosts.sh
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

need_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    echo -e "${RED}請用 sudo 執行${NC}"
    exit 1
  fi
}

need_root

DOMAINS=(
  "uat.pickcourt.hk"
  "lck.uat.pickcourt.hk"
  "admin.lck.uat.pickcourt.hk"
  "uat.picklevibes.hk"
)

echo "═══════════════════════════════════════════"
echo "  Apache VirtualHost 診斷"
echo "═══════════════════════════════════════════"
echo ""

echo "── 1. 監聽 port ──"
apache2ctl -t -D DUMP_RUN_CFG 2>/dev/null | grep -E '^Listen' || grep -R "^Listen" /etc/apache2/ports.conf 2>/dev/null || true
echo ""

echo "── 2. VirtualHost 對照（重點睇 default server）──"
apache2ctl -S 2>&1
echo ""

echo "── 3. sites-enabled ──"
ls -la /etc/apache2/sites-enabled/ 2>/dev/null || true
echo ""

echo "── 4. 用 Host header 測試本機 routing（:80）──"
for d in "${DOMAINS[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${d}" "http://127.0.0.1/" 2>/dev/null || echo "ERR")
  # 取 DocumentRoot 線索：跟 Server 標頭或首行 title 太複雜，只報 status
  echo "  Host: ${d}  →  HTTP ${code}"
done
echo ""

echo "── 5. 用 Host header 測試本機 routing（:443，若有）──"
if ss -tln 2>/dev/null | grep -q ':443 '; then
  for d in "${DOMAINS[@]}"; do
    code=$(curl -sk -o /dev/null -w '%{http_code}' -H "Host: ${d}" "https://127.0.0.1/" 2>/dev/null || echo "ERR")
    echo "  Host: ${d}  →  HTTPS ${code}"
  done
else
  echo "  （本機未 listen :443，跳過）"
fi
echo ""

echo "── 6. PickCourt site 設定摘要 ──"
for f in /etc/apache2/sites-available/pickcourt-uat.conf \
         /etc/apache2/sites-enabled/*pickcourt*; do
  [ -f "$f" ] || continue
  echo ">>> $f"
  grep -E 'VirtualHost|ServerName|ServerAlias|DocumentRoot|ProxyPass /api' "$f" 2>/dev/null | sed 's/^/    /'
done
echo ""

echo "═══════════════════════════════════════════"
echo -e "${YELLOW}常見原因：${NC}"
echo "  A) Cloudflare SSL=Full，但 origin 只有 :80 vhost → 請求去 :443 default"
echo "     → Cloudflare 改 Flexible，或 origin 加 :443 pickcourt vhost"
echo "  B) pickcourt site 未 enable / ServerName 打錯字"
echo "  C) pickcourt 係第一個 vhost 變 default（應用 010- 前綴 symlink）"
echo "  D) 用 IP 直訪 → 一定落 default server（正常）"
echo ""
echo "修正後：sudo apache2ctl configtest && sudo systemctl reload apache2"
echo "═══════════════════════════════════════════"
