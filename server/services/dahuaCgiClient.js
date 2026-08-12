/**
 * 大華門禁本機 CGI（Digest Auth）
 * openDoor / 寫入限時密碼用戶
 */
const http = require('http');
const https = require('https');
const crypto = require('crypto');

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
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
  const host = cfg.host;
  const port = Number(cfg.port || 80);
  const useHttps = Boolean(cfg.https);
  const user = cfg.user || 'admin';
  const pass = cfg.password || cfg.pass || '';
  if (!host) throw new Error('大華設備缺少 host');
  if (!pass) throw new Error('大華設備缺少密碼');

  const first = await requestOnce({
    host,
    port,
    useHttps,
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
    user,
    pass,
    method: 'GET',
    uri: pathWithQuery,
    challenge,
  });

  return requestOnce({
    host,
    port,
    useHttps,
    method: 'GET',
    pathWithQuery,
    headers: { Authorization: auth },
  });
}

/** 香港牆鐘 → 大華 ValidDate 格式 YYYYMMDD%20HHMMSS */
function formatDahuaTimeFromMs(ms) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value || '00';
  const y = get('year');
  const mo = get('month');
  const d = get('day');
  let h = get('hour');
  if (h === '24') h = '00';
  const mi = get('minute');
  const s = get('second');
  return `${y}${mo}${d}%20${h}${mi}${s}`;
}

/**
 * 遠端開門
 * channel 通常為 1（與 Doors 授權索引 0 不同）
 */
async function openDoor(cfg) {
  const channel = Number(cfg.doorChannel ?? cfg.channel ?? 1);
  const q = `/cgi-bin/accessControl.cgi?action=openDoor&channel=${channel}&Type=Remote`;
  const res = await digestGet(cfg, q);
  const ok = res.status === 200 && /OK/i.test(res.body || '');
  return { ok, status: res.status, body: (res.body || '').trim(), path: q };
}

/**
 * 寫入限時密碼用戶（本機認證，唔經 webhook）
 * Doors[0] 必須用門索引（此型號為 0），唔好用 openDoor channel
 */
async function enrollPasswordUser(cfg, { userId, password, cardName, startMs, endMs, useTime = 200 }) {
  const doorIndex = Number(cfg.doorIndex ?? 0);
  const uid = String(userId);
  const startStr = formatDahuaTimeFromMs(startMs);
  const endStr = formatDahuaTimeFromMs(endMs);
  const name = encodeURIComponent(String(cardName || 'PickCourt').slice(0, 32));

  const q =
    `/cgi-bin/recordUpdater.cgi?action=insert&name=AccessControlCard` +
    `&CardName=${name}` +
    `&CardNo=${encodeURIComponent(uid)}` +
    `&UserID=${encodeURIComponent(uid)}` +
    `&CardStatus=0&CardType=2` +
    `&Password=${encodeURIComponent(String(password))}` +
    `&Doors[0]=${doorIndex}` +
    `&TimeSections[0]=255` +
    `&ValidDateStart=${startStr}` +
    `&ValidDateEnd=${endStr}` +
    `&UseTime=${Number(useTime) || 200}`;

  const res = await digestGet(cfg, q);
  const ok = res.status === 200 && /RecNo|OK/i.test(res.body || '');
  return { ok, status: res.status, body: (res.body || '').trim(), userId: uid, path: q };
}

async function deleteUserById(cfg, userId) {
  const uid = encodeURIComponent(String(userId));
  const findQ = `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard&condition.UserID=${uid}`;
  const findRes = await digestGet(cfg, findQ);
  const recMatch = String(findRes.body || '').match(/records\[0\]\.RecNo=(\d+)/i);
  if (!recMatch) {
    return { ok: false, status: findRes.status, body: findRes.body, reason: 'not_found' };
  }
  const removeQ = `/cgi-bin/recordUpdater.cgi?action=remove&name=AccessControlCard&recno=${recMatch[1]}`;
  const removeRes = await digestGet(cfg, removeQ);
  const ok = removeRes.status === 200 && /OK/i.test(removeRes.body || '');
  return { ok, status: removeRes.status, body: (removeRes.body || '').trim(), recNo: recMatch[1] };
}

module.exports = {
  digestGet,
  openDoor,
  enrollPasswordUser,
  deleteUserById,
  formatDahuaTimeFromMs,
};
