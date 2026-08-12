/**
 * 測試用：收大華自動上傳；若掃到指定測試 QR，即刻遠端開門。
 *
 *   DAHUA_DEVICE_HOST=192.168.8.250 \
 *   DAHUA_DEVICE_USER=admin \
 *   DAHUA_DEVICE_PASS=xxx \
 *   node server/scripts/dahuaWebhookListen.js --port 8787 --auto-open --expect PC-TEST-
 */
require('dotenv').config();
const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const port = Number(
  (process.argv.find((a) => a.startsWith('--port=')) || '').split('=')[1] ||
    (process.argv.includes('--port')
      ? process.argv[process.argv.indexOf('--port') + 1]
      : 8787)
);
const autoOpen = process.argv.includes('--auto-open');
const expectPrefix =
  (process.argv.find((a) => a.startsWith('--expect=')) || '').split('=')[1] ||
  (process.argv.includes('--expect')
    ? process.argv[process.argv.indexOf('--expect') + 1]
    : 'PC-TEST-');

const DEVICE_HOST = process.env.DAHUA_DEVICE_HOST || '192.168.8.250';
const DEVICE_USER = process.env.DAHUA_DEVICE_USER || 'admin';
const DEVICE_PASS = process.env.DAHUA_DEVICE_PASS || '';
const HOOK_USER = process.env.DAHUA_HOOK_USER || 'admin';
const HOOK_PASS = process.env.DAHUA_HOOK_PASS || 'pickcourt';

const logDir = path.join(process.cwd(), 'tmp', 'dahua-webhook');
fs.mkdirSync(logDir, { recursive: true });

function lanIPs() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const [name, list] of Object.entries(ifs)) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) out.push({ name, address: i.address });
    }
  }
  return out;
}

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

function parseDigestChallenge(header) {
  const out = {};
  const m = String(header || '').match(/Digest\s+(.+)/i);
  if (!m) return null;
  m[1].replace(/(\w+)=(?:"([^"]+)"|([^,]+))/g, (_, k, q, raw) => {
    out[k] = q != null ? q : String(raw || '').trim();
  });
  return out;
}

function buildDigestAuth(method, uri, challenge, user, pass) {
  const realm = challenge.realm || '';
  const nonce = challenge.nonce || '';
  const qop = (challenge.qop || '').split(',')[0].trim();
  const opaque = challenge.opaque;
  const cnonce = crypto.randomBytes(8).toString('hex');
  const nc = '00000001';
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

function httpReq({ host, port: p = 80, method, path: reqPath, headers = {}, timeout = 12000 }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host, port: p, path: reqPath, method, headers, timeout },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function deviceDigestGet(reqPath) {
  if (!DEVICE_PASS) throw new Error('缺少 DAHUA_DEVICE_PASS');
  const first = await httpReq({ host: DEVICE_HOST, method: 'GET', path: reqPath });
  if (first.status !== 401) return first;
  const ch = parseDigestChallenge(first.headers['www-authenticate']);
  if (!ch) throw new Error('無 Digest challenge');
  const auth = buildDigestAuth('GET', reqPath, ch, DEVICE_USER, DEVICE_PASS);
  return httpReq({
    host: DEVICE_HOST,
    method: 'GET',
    path: reqPath,
    headers: { Authorization: auth },
  });
}

async function remoteOpenDoor() {
  const q = '/cgi-bin/accessControl.cgi?action=openDoor&channel=1&Type=Remote';
  const res = await deviceDigestGet(q);
  return res;
}

const openedUuids = new Set();
let seq = 0;

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const buf = Buffer.concat(chunks);
  const n = ++seq;
  const at = new Date().toISOString();
  const url = req.url || '/';

  if (/keepalive/i.test(url) && req.method === 'GET') {
    console.log(`[keepalive #${n}] from ${req.socket.remoteAddress}`);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  const entry = {
    n,
    at,
    method: req.method,
    url,
    remote: req.socket.remoteAddress,
    headers: req.headers,
    bodyText: buf.toString('utf8'),
    bodyLen: buf.length,
  };
  try {
    entry.bodyJson = JSON.parse(entry.bodyText);
  } catch {
    /* ignore */
  }

  const file = path.join(logDir, `${String(n).padStart(4, '0')}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(entry, null, 2));

  console.log('\n========== Dahua push #%s ==========', n);
  console.log(at, req.method, url, 'from', req.socket.remoteAddress);
  console.log(entry.bodyText.slice(0, 2000) || '(empty)');
  console.log('saved:', file);

  // 自動開門：Method 14 + QR 符合前綴
  if (autoOpen && entry.bodyJson?.Code === 'AccessControl') {
    const data = entry.bodyJson.Data || {};
    const qr = String(data.QRCode || data.QRCodeEx || '');
    const method = Number(data.Method);
    const uuid = String(data.TransmissionUuid || `${qr}-${data.RealUTC || ''}`);
    if (method === 14 && qr.startsWith(expectPrefix)) {
      if (openedUuids.has(uuid)) {
        console.log('⏭  已處理過 uuid，略過重送');
      } else {
        openedUuids.add(uuid);
        console.log(`🔓 掃到測試 QR「${qr}」→ 遠端開門…`);
        try {
          const openRes = await remoteOpenDoor();
          console.log(`   openDoor status=${openRes.status} body=${(openRes.body || '').trim()}`);
          entry.autoOpen = { ok: openRes.status === 200, status: openRes.status, body: openRes.body };
          fs.writeFileSync(file, JSON.stringify(entry, null, 2));
        } catch (err) {
          console.error('   openDoor 失敗:', err.message);
          entry.autoOpen = { ok: false, error: err.message };
          fs.writeFileSync(file, JSON.stringify(entry, null, 2));
        }
      }
    } else if (method === 14) {
      console.log(`ℹ️  Method 14 QR「${qr}」唔係測試前綴 ${expectPrefix}，唔自動開`);
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, received: n, Result: true, code: 0 }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`\n🎧 webhook :${port}  autoOpen=${autoOpen} expectPrefix=${expectPrefix}`);
  console.log(`📁 ${logDir}`);
  console.log(`🚪 device ${DEVICE_HOST} user=${DEVICE_USER}`);
  for (const { name, address } of lanIPs()) {
    console.log(`   LAN ${address} (${name})`);
  }
  console.log('\n請掃測試 QR。Ctrl+C 停止。\n');
});
