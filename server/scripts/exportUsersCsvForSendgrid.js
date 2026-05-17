/**
 * 將 MongoDB User 匯出為 CSV，供 SendGrid Marketing Contacts 上傳（CSV Import）。
 *
 * 用法（專案根目錄）：
 *   node server/scripts/exportUsersCsvForSendgrid.js
 *   node server/scripts/exportUsersCsvForSendgrid.js --out ./exports/sendgrid-users.csv
 *   node server/scripts/exportUsersCsvForSendgrid.js --include-inactive
 *   node server/scripts/exportUsersCsvForSendgrid.js --limit 100
 *
 * 需 .env 或環境變數：MONGODB_URI
 *
 * 欄位說明（SendGrid 常見對應：email / first_name / last_name；其餘可於匯入時對應自訂欄位或略過）：
 *   email, first_name, last_name, full_name, phone, role, membership_level,
 *   membership_expiry, is_active, skill_level, created_at
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');

function parseArgs(argv) {
  const out = { outPath: null, includeInactive: false, limit: 0 };
  for (const a of argv.slice(2)) {
    if (a === '--include-inactive') out.includeInactive = true;
    else if (a.startsWith('--out=')) out.outPath = a.slice('--out='.length).trim();
    else if (a.startsWith('--limit=')) out.limit = Math.max(0, parseInt(a.slice('--limit='.length), 10) || 0);
  }
  return out;
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function splitName(full) {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    first_name: (parts[0] || '').slice(0, 100),
    last_name: parts.slice(1).join(' ').slice(0, 100)
  };
}

function formatDateIso(d) {
  if (!d) return '';
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

const HEADERS = [
  'email',
  'first_name',
  'last_name',
  'full_name',
  'phone',
  'role',
  'membership_level',
  'membership_expiry',
  'is_active',
  'skill_level',
  'created_at'
];

async function main() {
  // const uri = process.env.MONGODB_URI;
  const uri = 'mongodb+srv://icesolution19:jLuZY1Lbi5UQNtyz@cluster0.nky9l.mongodb.net/picklevibes';
  if (!uri) {
    console.error('請設定 MONGODB_URI（可在專案根 .env）');
    process.exit(1);
  }

  const { outPath, includeInactive, limit } = parseArgs(process.argv);
  const resolvedOut = path.resolve(
    process.cwd(),
    outPath && outPath.length ? outPath : 'users-sendgrid-export.csv'
  );

  const filter = includeInactive ? {} : { isActive: true };

  await mongoose.connect(uri);
  console.log('✅ 已連線 MongoDB');

  const total = await User.countDocuments(filter);
  const cap = limit > 0 ? Math.min(limit, total) : total;
  console.log(`📊 符合條件用戶：${total} 筆${limit > 0 ? `（將匯出最多 ${cap} 筆）` : ''}`);

  const dir = path.dirname(resolvedOut);
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const stream = fs.createWriteStream(resolvedOut, { encoding: 'utf8' });
  stream.write('\uFEFF');
  stream.write(`${HEADERS.map(escapeCsvField).join(',')}\n`);

  const batchSize = 500;
  let exported = 0;
  let skip = 0;

  while (exported < cap) {
    const take = Math.min(batchSize, cap - exported);
    const users = await User.find(filter)
      .select('name email phone role membershipLevel membershipExpiry isActive preferences.skillLevel createdAt')
      .sort({ _id: 1 })
      .skip(skip)
      .limit(take)
      .lean();

    if (!users.length) break;

    for (const u of users) {
      const email = String(u.email || '').toLowerCase().trim();
      if (!email) continue;
      const { first_name, last_name } = splitName(u.name);
      const row = [
        email,
        first_name,
        last_name,
        String(u.name || '').trim(),
        u.phone || '',
        u.role || '',
        u.membershipLevel || '',
        formatDateIso(u.membershipExpiry),
        u.isActive === false ? 'false' : 'true',
        u.preferences?.skillLevel || '',
        u.createdAt ? new Date(u.createdAt).toISOString() : ''
      ];
      stream.write(`${row.map(escapeCsvField).join(',')}\n`);
      exported += 1;
      if (exported >= cap) break;
    }

    skip += users.length;
    if (users.length < batchSize) break;
  }

  await new Promise((resolve, reject) => {
    stream.end((err) => (err ? reject(err) : resolve()));
  });

  await mongoose.connection.close();
  console.log(`🔌 已關閉連線`);
  console.log(`✅ 已匯出 ${exported} 筆 → ${resolvedOut}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };
