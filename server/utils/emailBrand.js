/**
 * 電郵／通知品牌（PickCourt UAT／正式以 env 覆寫；預設 PickCourt）
 */
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
    /** Gmail / SMTP from header */
    fromHeader: `"${fromName}" <${process.env.GMAIL_USER || supportEmail}>`,
    contactLine: `📧 ${supportEmail}${supportPhone ? ` | 📞 ${supportPhone}` : ''}`,
    copyright: `© ${year} ${name}. All rights reserved.`,
  };
}

module.exports = { getEmailBrand };
