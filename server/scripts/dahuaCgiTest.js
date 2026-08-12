/**
 * 大華門禁本機 CGI 測試（DHI-ASI3213A-W 等 ASI3XXX）
 *
 * 必須喺同門禁同一 LAN／VPN 嘅機器執行。
 *
 * 用法：
 *   # 探測 HTTP／常見 port
 *   node server/scripts/dahuaCgiTest.js probe --host 192.168.8.250
 *
 *   # 遠端開門（試一次）
 *   node server/scripts/dahuaCgiTest.js open --host 192.168.8.250 --user admin --pass 'YOUR_PASS' --yes
 *
 *   # 寫入 10 分鐘限時密碼用戶，並產 QR PNG
 *   node server/scripts/dahuaCgiTest.js enroll --host 192.168.8.250 --user admin --pass 'YOUR_PASS' --yes
 *
 *   # 刪除測試用戶
 *   node server/scripts/dahuaCgiTest.js delete --host 192.168.8.250 --user admin --pass 'YOUR_PASS' --user-id 99001 --yes
 *
 * 環境變數（可代替 flag）：
 *   DAHUA_DEVICE_HOST / DAHUA_DEVICE_USER / DAHUA_DEVICE_PASS / DAHUA_HTTP_PORT
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const net = require('net');
const QRCode = require('qrcode');

function parseArgs(argv) {
  const rest = argv.slice(2);
  const cmd = rest[0];
  const flags = {};
  for (let i = 1; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { cmd, flags };
}

function printUsage() {
  console.log(`
大華 CGI 測試工具

指令：
  probe   --host <ip> [--port 80]
  open    --host <ip> --user <u> --pass <p> [--yes]
  enroll  --host <ip> --user <u> --pass <p> [--minutes 10] [--yes]
  delete  --host <ip> --user <u> --pass <p> --user-id <id> [--yes]

例：
  node server/scripts/dahuaCgiTest.js probe --host 192.168.8.250
  node server/scripts/dahuaCgiTest.js enroll --host 192.168.8.250 --user admin --pass 'xxx' --yes
`);
}

function cfgFromFlags(flags) {
  return {
    host: flags.host || process.env.DAHUA_DEVICE_HOST || '192.168.8.250',
    port: Number(flags.port || process.env.DAHUA_HTTP_PORT || 80),
    user: flags.user || process.env.DAHUA_DEVICE_USER || 'admin',
    pass: flags.pass || process.env.DAHUA_DEVICE_PASS || '',
    https: Boolean(flags.https),
    yes: Boolean(flags.yes),
    minutes: Math.max(1, Number(flags.minutes || 10)),
    userId: String(flags['user-id'] || flags.userId || '99001'),
    /** openDoor CGI channel 通常係 1；Doors[] 授權索引呢部機係 0 */
    channel: Number(flags.channel || 1),
    doorIndex: Number(flags.door ?? flags['door-index'] ?? 0),
  };
}

function tcpProbe(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

function parseDigestChallenge(wwwAuth) {
  const out = {};
  const m = String(wwwAuth || '').match(/Digest\s+(.+)/i);
  if (!m) return null;
  m[1].replace(/(\w+)=(?:"([^"]+)"|([^,]+))/g, (_, k, q, raw) => {
    out[k] = q != null ? q : String(raw || '').trim();
  });
  return out;
}

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

function buildDigestAuthHeader({ user, pass, method, uri, challenge, nc = '00000001' }) {
  const realm = challenge.realm || '';
  const nonce = challenge.nonce || '';
  const qop = (challenge.qop || '').split(',')[0].trim();
  const opaque = challenge.opaque;
  const cnonce = crypto.randomBytes(8).toString('hex');
  const ha1 = md5(`${user}:${realm}:${pass}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  let header = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (qop) header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (opaque) header += `, opaque="${opaque}"`;
  if (challenge.algorithm) header += `, algorithm=${challenge.algorithm}`;
  return header;
}

function requestOnce({ host, port, useHttps, method, pathWithQuery, headers = {}, timeoutMs = 12000 }) {
  const lib = useHttps ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        host,
        port,
        path: pathWithQuery,
        method,
        headers,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`連線逾時 ${host}:${port}`));
    });
    req.on('error', reject);
    req.end();
  });
}

async function digestGet(cfg, pathWithQuery) {
  if (!cfg.pass) throw new Error('缺少 --pass 或 DAHUA_DEVICE_PASS');

  const first = await requestOnce({
    host: cfg.host,
    port: cfg.port,
    useHttps: cfg.https,
    method: 'GET',
    pathWithQuery,
  });

  if (first.status !== 401) {
    return first;
  }

  const challenge = parseDigestChallenge(first.headers['www-authenticate']);
  if (!challenge) {
    throw new Error(`收到 401 但唔係 Digest：${first.headers['www-authenticate'] || '(no header)'}`);
  }

  const auth = buildDigestAuthHeader({
    user: cfg.user,
    pass: cfg.pass,
    method: 'GET',
    uri: pathWithQuery,
    challenge,
  });

  return requestOnce({
    host: cfg.host,
    port: cfg.port,
    useHttps: cfg.https,
    method: 'GET',
    pathWithQuery,
    headers: { Authorization: auth },
  });
}

function formatDahuaTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}%20${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function cmdProbe(cfg) {
  console.log(`\n探測 ${cfg.host} ...\n`);
  const ports = [cfg.port, 80, 443, 8000, 8080, 8443, 37777].filter(
    (v, i, a) => a.indexOf(v) === i
  );
  for (const p of ports) {
    const ok = await tcpProbe(cfg.host, p, 2000);
    console.log(`  port ${p}: ${ok ? 'OPEN' : 'closed/timeout'}`);
  }

  for (const useHttps of [false, true]) {
    const port = useHttps ? (cfg.port === 80 ? 443 : cfg.port) : cfg.port;
    try {
      const res = await requestOnce({
        host: cfg.host,
        port,
        useHttps,
        method: 'GET',
        pathWithQuery: '/',
        timeoutMs: 5000,
      });
      console.log(`  ${useHttps ? 'https' : 'http'}://${cfg.host}:${port}/ → ${res.status}`);
    } catch (err) {
      console.log(`  ${useHttps ? 'https' : 'http'}://${cfg.host}:${port}/ → ${err.message}`);
    }
  }
  console.log('');
}

async function cmdOpen(cfg) {
  if (!cfg.yes) {
    console.log('⚠️  將遠端開門。確認請加 --yes');
    return;
  }
  const q = `/cgi-bin/accessControl.cgi?action=openDoor&channel=${cfg.channel}&Type=Remote`;
  console.log(`\n→ GET ${q}`);
  const res = await digestGet(cfg, q);
  console.log(`status=${res.status}`);
  console.log(res.body || '(empty body)');
  console.log(res.status === 200 && /OK/i.test(res.body || '') ? '\n✅ 遠端開門指令已接受\n' : '\n⚠️  請檢查帳密／權限／回應\n');
}

async function cmdEnroll(cfg) {
  if (!cfg.yes) {
    console.log('⚠️  將寫入限時測試用戶。確認請加 --yes');
    return;
  }

  const password = String(Math.floor(100000 + Math.random() * 900000));
  const userId = cfg.userId;
  const cardNo = userId;
  const now = new Date();
  const end = new Date(now.getTime() + cfg.minutes * 60 * 1000);
  const startStr = formatDahuaTime(now);
  const endStr = formatDahuaTime(end);

  const q =
    `/cgi-bin/recordUpdater.cgi?action=insert&name=AccessControlCard` +
    `&CardName=PickCourtTest` +
    `&CardNo=${encodeURIComponent(cardNo)}` +
    `&UserID=${encodeURIComponent(userId)}` +
    `&CardStatus=0&CardType=2` +
    `&Password=${encodeURIComponent(password)}` +
    `&Doors[0]=${cfg.doorIndex}` +
    `&TimeSections[0]=255` +
    `&ValidDateStart=${startStr}` +
    `&ValidDateEnd=${endStr}` +
    `&UseTime=100`;

  console.log(`\n→ 寫入限時用戶 UserID=${userId} 密碼=${password} 有效 ${cfg.minutes} 分`);
  const res = await digestGet(cfg, q);
  console.log(`status=${res.status}`);
  console.log(res.body || '(empty body)');

  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const candidates = [
    { name: 'password', text: password },
    { name: 'cardNo', text: cardNo },
    { name: 'userId-password', text: `${userId},${password}` },
  ];

  console.log('\n產 QR（請喺門禁掃碼介面逐張試）：');
  for (const c of candidates) {
    const file = path.join(outDir, `dahua-qr-${c.name}.png`);
    await QRCode.toFile(file, c.text, { width: 320, margin: 2 });
    console.log(`  ${c.name}: "${c.text}" → ${file}`);
  }

  console.log(`
測試步驟：
  1. 機上用密碼開門：輸入 ${password}
  2. 掃 tmp/dahua-qr-*.png 睇邊張得
  3. 測完刪用戶：
     node server/scripts/dahuaCgiTest.js delete --host ${cfg.host} --user ${cfg.user} --pass '***' --user-id ${userId} --yes
`);
}

async function cmdDelete(cfg) {
  if (!cfg.yes) {
    console.log('⚠️  將刪除用戶。確認請加 --yes');
    return;
  }
  // 常見：先 find RecNo，再 remove。部分韌體支援 condition.UserID
  const findQ =
    `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard` +
    `&condition.UserID=${encodeURIComponent(cfg.userId)}&count=10`;
  console.log(`\n→ 查找 UserID=${cfg.userId}`);
  const found = await digestGet(cfg, findQ);
  console.log(`status=${found.status}`);
  console.log(found.body || '(empty)');

  const recMatch = String(found.body || '').match(/records\[\d+\]\.RecNo=(\d+)/i);
  if (!recMatch) {
    console.log('\n⚠️  搵唔到 RecNo，請喺門禁 Web「用戶」手動刪 PickCourtTest\n');
    return;
  }
  const recNo = recMatch[1];
  const delQ = `/cgi-bin/recordUpdater.cgi?action=remove&name=AccessControlCard&RecNo=${recNo}`;
  console.log(`\n→ 刪除 RecNo=${recNo}`);
  const del = await digestGet(cfg, delQ);
  console.log(`status=${del.status}`);
  console.log(del.body || '(empty)');
  console.log('\n✅ 刪除指令已送出\n');
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv);
  if (!cmd || cmd === 'help' || flags.help) {
    printUsage();
    process.exit(0);
  }
  const cfg = cfgFromFlags(flags);

  switch (cmd) {
    case 'probe':
      await cmdProbe(cfg);
      break;
    case 'open':
      await cmdOpen(cfg);
      break;
    case 'enroll':
      await cmdEnroll(cfg);
      break;
    case 'delete':
      await cmdDelete(cfg);
      break;
    default:
      console.error(`未知指令：${cmd}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌', err.message || err);
  process.exit(1);
});
