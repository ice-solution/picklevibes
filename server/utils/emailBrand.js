/**
 * 電郵／通知品牌（PickCourt UAT／正式以 env 覆寫；預設 PickCourt）
 */
const fs = require('fs');
const path = require('path');

function logoMimeFromPath(logoPath) {
  const ext = path.extname(logoPath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

/** 解析電郵 Logo 路徑（預設 PickCourt；可用 EMAIL_LOGO_PATH 覆寫） */
function resolveEmailLogoPath() {
  const fromEnv = String(process.env.EMAIL_LOGO_PATH || '').trim();
  if (fromEnv) {
    const resolved = path.resolve(fromEnv);
    if (fs.existsSync(resolved)) return resolved;
  }

  const candidates = [
    path.join(__dirname, '../assets/pickcourt_logo.jpg'),
    path.join(__dirname, '../../pickcourt_logo.jpg'),
    path.join(__dirname, '../../client/public/pickcourt_logo.jpg'),
    // 舊 PickleVibes 主站 fallback（僅當 PickCourt 檔不存在）
    path.join(__dirname, '../../uploads/static/logo192.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

function getEmailBrand() {
  const name = String(
    process.env.EMAIL_BRAND_NAME || process.env.PLATFORM_DISPLAY_NAME || 'PickCourt'
  ).trim() || 'PickCourt';
  const siteUrl = String(process.env.CLIENT_URL || 'https://pickcourt.hk').replace(/\/+$/, '');
  let siteHost = 'pickcourt.hk';
  try {
    siteHost = new URL(siteUrl).hostname.replace(/^www\./, '') || siteHost;
  } catch {
    // keep default
  }
  const supportEmail = String(
    process.env.SUPPORT_EMAIL || process.env.NOTICE_EMAIL || 'info@pickcourt.hk'
  ).trim();
  const supportPhone = String(
    process.env.SUPPORT_PHONE || process.env.NOTICE_PHONE || '+852 6190 2761'
  ).trim();
  const fromName = String(process.env.EMAIL_FROM_NAME || `${name}`).trim() || name;
  const tagline = String(
    process.env.EMAIL_BRAND_TAGLINE || '聯盟場地預約平台'
  ).trim();
  const teamName = String(process.env.EMAIL_TEAM_NAME || `${name} 團隊`).trim();
  const venueLabel = String(process.env.EMAIL_VENUE_LABEL || `${name} 場地`).trim();
  const year = new Date().getFullYear();
  const logoPath = resolveEmailLogoPath();
  const logoFilename = path.basename(logoPath);
  const logoMime = logoMimeFromPath(logoPath);

  return {
    name,
    siteUrl,
    siteHost,
    supportEmail,
    supportPhone,
    fromName,
    tagline,
    teamName,
    venueLabel,
    year,
    logoPath,
    logoFilename,
    logoMime,
    /** Gmail / SMTP from header */
    fromHeader: `"${fromName}" <${process.env.GMAIL_USER || supportEmail}>`,
    contactLine: `📧 ${supportEmail}${supportPhone ? ` | 📞 ${supportPhone}` : ''}`,
    copyright: `© ${year} ${name}. All rights reserved.`,
  };
}

module.exports = { getEmailBrand, resolveEmailLogoPath, logoMimeFromPath };
